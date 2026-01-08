# Cloudship App - Project Summary

## Overview

Cloudship is a production-ready Shopify app that solves the problem of per-warehouse shipping transparency. The app enables merchants to clearly communicate shipping costs and delivery times from multiple warehouse locations, improving customer experience and reducing cart abandonment.

## Problem Solved

Shopify's native checkout combines shipping rates when items come from multiple warehouses, showing customers a single shipping cost and delivery time. This creates confusion when:
- Items ship from different locations (local vs international)
- Delivery times vary significantly (1-2 days vs 7-10 days)
- Customers cannot see which items ship from where

## Solution Architecture

### Core Functionality

1. **Location-Based Shipping Configuration**
   - Merchants configure shipping costs and ETAs per Shopify Location
   - Support for fixed or per-item pricing
   - Priority-based location assignment

2. **Intelligent Item Grouping**
   - Groups cart items by warehouse location based on inventory
   - Uses Shopify Admin API to query inventory levels
   - Safe fallback logic for missing inventory data

3. **Platform-Aware Checkout Display**
   - **Shopify Plus:** Uses Checkout UI Extensions for full transparency
   - **Non-Plus:** Returns combined rate with breakdown in description (Shopify limitation)

4. **CarrierService Integration**
   - Implements Shopify CarrierService API
   - Calculates rates dynamically based on cart contents
   - Respects Shopify platform constraints

## Feature Breakdown

### 1. Merchant Admin UI (`/locations`)
- **Technology:** Next.js, React, Polaris, App Bridge
- **Features:**
  - View all Shopify Locations
  - Configure shipping cost per location
  - Set delivery time estimates (min/max days)
  - Configure cost type (fixed or per-item)
  - Set location priority
  - Visual status indicators

### 2. Shipping Calculation Engine (`lib/shipping.ts`)
- **Core Logic:**
  - Fetches inventory levels via GraphQL
  - Groups items by location with available inventory
  - Calculates shipping costs per group
  - Formats rates based on Plus status
- **Fallbacks:**
  - Assigns to first available location if inventory missing
  - Default shipping values if location not configured

### 3. CarrierService API (`/api/shipping-rates`)
- **Endpoint:** POST `/api/shipping-rates?shop={shop}`
- **Security:** HMAC verification via query parameters
- **Behavior:**
  - Receives cart items from Shopify
  - Groups by warehouse
  - Returns formatted rates
  - Non-Plus: Single rate with breakdown
  - Plus: Multiple rates or single with extension

### 4. Checkout UI Extension (`extensions/checkout-ui-extension`)
- **Target:** `purchase.checkout.shipping-address.render-after`
- **Purpose:** Show shipping breakdown in Plus checkout
- **Technology:** Shopify UI Extensions React
- **Note:** Requires Plus subscription

### 5. OAuth & Authentication
- **Flow:** Standard Shopify OAuth 2.0
- **Security:** Encrypted token storage (AES-256-GCM)
- **Endpoints:**
  - `/api/auth/begin` - Initiate OAuth
  - `/api/auth/callback` - Handle callback

### 6. Webhook Handlers
- **app/uninstalled:** Deactivates shop in database
- **shop/update:** Updates Plus status
- **Security:** HMAC signature verification

## Shopify Limitations & Assumptions

### Critical Limitations

1. **Non-Plus Stores Cannot Show Multiple Shipping Methods**
   - Platform constraint, not app limitation
   - Solution: Single combined rate with breakdown in description
   - Breakdown format: "Shipping includes:\n• Location A (1-2 days): $10\n• Location B (7-10 days): $5"

2. **Checkout UI Extensions Available Only for Plus**
   - Non-Plus stores cannot use extensions
   - Solution: Breakdown in rate description

3. **CarrierService Must Return Valid Rate Format**
   - Must follow Shopify API specification
   - Single rate for non-Plus
   - Can return multiple rates for Plus (if configured)

### Assumptions

1. **Inventory Tracking**
   - Merchants track inventory in Shopify Locations
   - Variants have inventory assigned to locations
   - Inventory data is accurate

2. **Location Configuration**
   - Merchants have configured locations in Shopify
   - Locations are active and valid
   - Address information is complete

3. **Shipping Logic**
   - Items are assigned to locations with available inventory
   - First location with inventory is preferred
   - Priority setting influences assignment order

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Shopify Store                        │
└────┬──────────┬──────────┬──────────┬──────────┬───────┘
     │          │          │          │          │
     │          │          │          │          │
     ▼          ▼          ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌─────────┐
│ OAuth  │ │ Admin  │ │Carrier │ │Webhooks│ │Checkout │
│ Flow   │ │  UI    │ │Service │ │        │ │Extension│
└───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘ └────┬─────┘
    │          │          │          │           │
    └──────────┴──────────┴──────────┴───────────┘
                    │
                    ▼
          ┌─────────────────┐
          │  Next.js App    │
          │  (API Routes)   │
          └────────┬────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌──────────────┐      ┌──────────────┐
│  PostgreSQL  │      │  Shopify API │
│  (Prisma)    │      │  (GraphQL)   │
└──────────────┘      └──────────────┘
```

## Database Schema

### Shop Table
- Stores shop information
- Encrypted access tokens
- Plus status tracking
- Active/inactive status

### LocationSetting Table
- Maps Shopify Location IDs to shipping config
- Shipping cost and type
- ETA range (min/max days)
- Priority for assignment
- Active status

### Webhook Table
- Tracks registered webhooks
- Links to shop
- Stores Shopify webhook IDs

## Checkout & Shipping Logic Flow

```
1. Customer adds items to cart
   ↓
2. Checkout page loads
   ↓
3. Shopify calls CarrierService API
   ↓
4. App receives cart items
   ↓
5. Query inventory levels (GraphQL)
   ↓
6. Group items by location
   ↓
7. Fetch location settings (Database)
   ↓
8. Calculate shipping per group
   ↓
9. Format rates based on Plus status
   ├─ Non-Plus: Single rate + breakdown
   └─ Plus: Multiple rates or extension
   ↓
10. Return rates to Shopify
   ↓
11. Shopify displays rates in checkout
```

## Shopify Plus vs Non-Plus Behavior

### Non-Plus Stores

**CarrierService Response:**
```json
{
  "rates": [
    {
      "name": "Shipping includes:\n• Warehouse A (1-2 days): $10.00\n• Warehouse B (7-10 days): $5.00",
      "price": "15.00",
      "code": "cloudship_combined",
      "source": "cloudship"
    }
  ]
}
```

**Checkout Display:**
- Single shipping option shown
- Breakdown visible in rate name/description
- Customer sees all warehouses in description

### Shopify Plus Stores

**CarrierService Response (Multiple Rates):**
```json
{
  "rates": [
    {
      "name": "Warehouse A (1-2 days)",
      "price": "10.00",
      "code": "warehouse_123",
      "source": "cloudship"
    },
    {
      "name": "Warehouse B (7-10 days)",
      "price": "5.00",
      "code": "warehouse_456",
      "source": "cloudship"
    }
  ]
}
```

**Checkout UI Extension:**
- Additional breakdown component
- Visual representation of shipments
- Enhanced transparency

**Checkout Display:**
- Multiple rates shown (if configured)
- Extension shows detailed breakdown
- Maximum transparency

## File Tree

```
cloudship-app/
├── extensions/
│   └── checkout-ui-extension/
│       ├── src/
│       │   └── index.tsx
│       ├── package.json
│       └── shopify.ui.extension.toml
├── lib/
│   ├── db.ts
│   ├── encryption.ts
│   ├── shopify.ts
│   ├── shipping.ts
│   ├── webhook-verification.ts
│   └── webhook-registration.ts
├── pages/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── begin.ts
│   │   │   └── callback.ts
│   │   ├── locations/
│   │   │   ├── index.ts
│   │   │   └── settings.ts
│   │   ├── shop.ts
│   │   ├── shipping-rates.ts
│   │   └── webhooks/
│   │       ├── app/
│   │       │   └── uninstalled.ts
│   │       └── shop/
│   │           └── update.ts
│   ├── _app.tsx
│   ├── index.tsx
│   └── locations.tsx
├── prisma/
│   └── schema.prisma
├── .env.example
├── .eslintrc.json
├── .gitignore
├── next.config.js
├── next-env.d.ts
├── package.json
├── tsconfig.json
├── README.md
├── DEPLOYMENT.md
└── PROJECT_SUMMARY.md
```

## Security Implementation

1. **OAuth Flow:** Standard Shopify OAuth 2.0
2. **Token Encryption:** AES-256-GCM encryption for access tokens
3. **Webhook Verification:** HMAC SHA-256 signature verification
4. **API Security:** HMAC verification for CarrierService requests
5. **Scope Limitation:** Only required scopes requested
6. **No Secrets in Code:** All secrets via environment variables
7. **CSRF Protection:** Built into App Bridge
8. **XSS Protection:** React and Polaris handle sanitization

## Testing & Acceptance Criteria

### Installation
- ✅ App installs via OAuth flow
- ✅ Shop record created in database
- ✅ Webhooks registered
- ✅ Plus status detected

### Configuration
- ✅ Locations list loads from Shopify
- ✅ Settings can be created/updated/deleted
- ✅ Settings persist in database
- ✅ Validation works correctly

### Shipping Calculation
- ✅ Items grouped by location correctly
- ✅ Shipping costs calculated accurately
- ✅ ETAs included in rates
- ✅ Fallback logic works
- ✅ Non-Plus returns single rate
- ✅ Plus returns appropriate format

### Checkout Display
- ✅ Rates appear in checkout
- ✅ Breakdown visible (non-Plus in description)
- ✅ Extension shows breakdown (Plus)
- ✅ Formatting is clear and readable

### Webhooks
- ✅ App uninstall deactivates shop
- ✅ Shop update updates Plus status
- ✅ HMAC verification works
- ✅ Errors handled gracefully

## Deployment Requirements

1. **Infrastructure:**
   - Node.js 18+ runtime
   - PostgreSQL database
   - SSL/TLS certificate
   - Domain with DNS configured

2. **Environment:**
   - All required environment variables set
   - Encryption key generated securely
   - Database connection string configured

3. **Shopify Configuration:**
   - App URL set in Partner Dashboard
   - Redirect URLs configured
   - Webhook subscriptions created
   - CarrierService registered (post-install)

4. **Post-Deployment:**
   - Database migrations run
   - Test installation on dev store
   - Verify all endpoints work
   - Monitor logs for errors

## Next Steps for Enhancement

While the current implementation is production-ready, potential enhancements include:

1. **Caching:** Redis for location settings
2. **Analytics:** Track shipping calculations
3. **Advanced Grouping:** More sophisticated location assignment logic
4. **Multi-Currency:** Support for different currencies
5. **International Shipping:** Customs and duty calculations
6. **Rate Caching:** Cache rates for similar cart combinations
7. **Admin Dashboard:** Analytics and insights page
8. **Bulk Configuration:** Import/export location settings

---

This app is production-ready and can be installed on Shopify dev stores immediately after database setup and environment configuration.
