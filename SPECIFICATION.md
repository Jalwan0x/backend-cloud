# Cloudship App - Complete Specification

## 1) Project Summary

Cloudship is a production-ready Shopify app that solves the critical problem of per-warehouse shipping transparency. When customers add items from multiple Shopify Locations (warehouses) to their cart, Shopify combines shipping into a single rate and delivery time, hiding the fact that items ship separately from different locations.

The app:
- Detects which cart items belong to which Shopify Location
- Calculates shipping cost and ETA per warehouse
- Returns ONE combined shipping rate (Shopify requirement)
- Shows customers a clear breakdown of warehouse shipments
- Works for both Shopify Plus and non-Plus merchants

**Key Value Proposition:**
- Customers understand which items ship fast vs slow
- Merchants can set per-warehouse shipping costs and ETAs
- Transparent shipping information reduces cart abandonment
- Respects all Shopify platform constraints

## 2) Feature Breakdown

### Merchant Features

**Location Configuration (Admin UI)**
- View all Shopify Locations
- Configure shipping cost per location (fixed base price)
- Set delivery ETA range (min days, max days)
- Enable/disable locations
- Set location priority for inventory assignment
- Toggle shipping breakdown visibility
- Toggle split shipping (Plus only)

**Shipping Calculation**
- Automatic item grouping by Shopify Location
- Inventory-based location detection
- Priority-based location assignment
- Fallback logic for missing inventory data
- Deterministic grouping for consistency

**Platform Integration**
- Shopify OAuth installation flow
- CarrierService API integration
- Webhook handlers (app/uninstalled, shop/update)
- Checkout UI Extension for Plus stores
- Encrypted token storage

### Customer Features

**Non-Plus Stores:**
- Single shipping rate with breakdown in description:
  ```
  Shipping includes:
  • Local Warehouse (1-2 days): $10.00
  • Overseas Warehouse (7-10 days): $5.00
  ```

**Plus Stores:**
- Checkout UI Extension shows detailed breakdown
- Per-warehouse shipping visibility
- Separate shipment information

### Technical Features

**Backend:**
- Next.js API routes
- PostgreSQL + Prisma ORM
- Shopify Admin API (GraphQL)
- CarrierService endpoint
- Webhook verification (HMAC)
- Token encryption (AES-256-GCM)

**Frontend:**
- Next.js + React + TypeScript
- Shopify Polaris components
- App Bridge for embedded app
- Responsive merchant admin UI

**Extensions:**
- Checkout UI Extension (Plus only)
- Shipping breakdown display

## 3) Shopify Limitations & Assumptions

### Critical Limitations

**Non-Plus Stores:**
- **CANNOT** show multiple selectable shipping methods
- **MUST** return exactly ONE shipping rate via CarrierService
- Breakdown is shown in the rate name/description field
- This is a Shopify platform limitation, not an app limitation

**Checkout UI Extensions:**
- Available **ONLY** for Shopify Plus stores
- Cannot add new shipping methods
- Can only display information, not create rates

**CarrierService API:**
- Must return valid Shopify rate format
- Single rate required for non-Plus
- HMAC verification required for security

### Assumptions

**Inventory Tracking:**
- Merchants track inventory in Shopify Locations
- Product variants have inventory assigned to locations
- Inventory data is accurate and up-to-date

**Location Configuration:**
- Merchants have configured locations in Shopify
- Locations are active and valid
- Address information is complete

**Shipping Logic:**
- Items are assigned to locations with available inventory
- First location with inventory is preferred (by priority)
- Fallback assigns to first configured location if inventory missing
- Priority setting influences assignment order

**Platform Behavior:**
- Shopify CarrierService calls app endpoint during checkout
- Request includes cart items with variant IDs
- App must respond with rates in valid format
- Response time should be reasonable (< 5 seconds)

## 4) System Architecture

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
          │  Next.js App    │
          │  (Render)       │
          │  API Routes    │
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

**Data Flow:**

1. **Installation:** OAuth flow → Store tokens → Register webhooks
2. **Configuration:** Admin UI → Fetch locations → Save settings → Database
3. **Checkout:** CarrierService request → Group items → Calculate rates → Return single rate
4. **Display:** Shopify shows rate → Plus stores see extension → Breakdown visible

**Components:**

- **API Layer:** Next.js API routes handle all Shopify interactions
- **Business Logic:** Shipping calculation engine groups items and calculates rates
- **Data Layer:** Prisma ORM manages database operations
- **UI Layer:** Polaris components provide merchant interface
- **Extension Layer:** Checkout UI Extension (Plus only) shows breakdown

## 5) Database Schema

### Prisma Schema

```prisma
model Shop {
  id                String   @id @default(cuid())
  shopifyId         String   @unique
  shopDomain        String   @unique
  accessToken       String   // Encrypted
  scopes            String
  isActive          Boolean  @default(true)
  isPlus            Boolean  @default(false)
  showBreakdown     Boolean  @default(true)
  sumRates          Boolean  @default(true)
  enableSplitShipping Boolean @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  locationSettings  LocationSetting[]
  webhooks          Webhook[]

  @@map("shops")
}

model LocationSetting {
  id                String   @id @default(cuid())
  shopId            String
  shopifyLocationId String
  locationName      String
  shippingCost      Float    @default(0)
  etaMin            Int      @default(1)
  etaMax            Int      @default(2)
  isActive          Boolean  @default(true)
  priority          Int      @default(0)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  shop              Shop     @relation(fields: [shopId], references: [id], onDelete: Cascade)

  @@unique([shopId, shopifyLocationId])
  @@map("location_settings")
}

model Webhook {
  id        String   @id @default(cuid())
  shopId    String
  topic     String
  shopifyId String?  @unique
  createdAt DateTime @default(now())

  shop      Shop     @relation(fields: [shopId], references: [id], onDelete: Cascade)

  @@unique([shopId, topic])
  @@map("webhooks")
}
```

**Relationships:**
- Shop → LocationSetting (one-to-many)
- Shop → Webhook (one-to-many)
- Cascade delete ensures data consistency

**Key Fields:**
- `accessToken`: Encrypted using AES-256-GCM
- `shopifyLocationId`: Stores Shopify Location GID (numeric ID)
- `priority`: Lower number = higher priority for assignment
- `isPlus`: Tracks Shopify Plus status for feature gating

## 6) Checkout & Shipping Logic Flow

### Step-by-Step Process

```
1. Customer adds items to cart
   ↓
2. Customer proceeds to checkout
   ↓
3. Shopify calls CarrierService endpoint
   POST /api/shipping-rates?shop={shop}&hmac={hmac}
   ↓
4. App verifies HMAC signature
   ↓
5. App extracts cart items from request body
   ↓
6. For each cart item:
   - Query inventory levels via GraphQL
   - Find locations with available inventory
   - Select location by priority
   - Fallback to first configured location
   ↓
7. Group items by selected location
   ↓
8. Fetch location settings from database
   ↓
9. Calculate shipping per warehouse group:
   - Apply configured shipping cost
   - Attach ETA (min-max days)
   ↓
10. Combine all warehouse costs into ONE total
    ↓
11. Format rate response:
    - Non-Plus: Single rate with breakdown in description
    - Plus: Single rate (extension handles breakdown)
    ↓
12. Return rates to Shopify
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
    ↓
13. Shopify displays rate in checkout
    ↓
14. Plus stores: Checkout UI Extension renders breakdown
```

### Location Detection Logic

1. **Query Inventory:** GraphQL query fetches inventory levels for all cart variants
2. **Filter Available:** Only locations with available > 0 inventory
3. **Sort by Priority:** Order locations by configured priority (lower = preferred)
4. **Select Location:** First location with inventory (by priority)
5. **Fallback:** If no inventory found, use first configured location
6. **Group Items:** Assign items to selected location

### Shipping Calculation Logic

1. **Per Group:** Calculate shipping cost for each warehouse group
2. **Apply Settings:** Use configured shipping cost from LocationSetting
3. **Combine Totals:** Sum all warehouse shipping costs
4. **Format Breakdown:** Create readable breakdown text
5. **Return Rate:** Single combined rate with breakdown in description

## 7) Shopify Plus vs Non-Plus Behavior

### All Stores (with carrier calculated shipping enabled)

**CarrierService Response:**
```json
{
  "rates": [
    {
      "name": "Shipping includes:\n• Local Warehouse (1-2 days): $10.00\n• Overseas Warehouse (7-10 days): $5.00",
      "price": "15.00",
      "code": "cloudship_combined",
      "source": "cloudship"
    }
  ]
}
```

**Checkout Display:**
- Customer sees ONE shipping option
- Breakdown text is visible in rate name/description
- Format: "Shipping includes:\n• [Warehouse] ([days]): $[cost]\n• ..."
- Customer understands multiple shipments
- Works for ANY store with carrier calculated shipping enabled

**Limitations:**
- Cannot show multiple selectable rates (Shopify platform requirement)
- Breakdown must fit in description field
- No visual enhancements (text only) for non-Plus stores

### Shopify Plus Stores (additional features)

**CarrierService Response:**
```json
{
  "rates": [
    {
      "name": "Shipping includes:\n• Local Warehouse (1-2 days): $10.00\n• Overseas Warehouse (7-10 days): $5.00",
      "price": "15.00",
      "code": "cloudship_combined",
      "source": "cloudship"
    }
  ]
}
```

**Checkout UI Extension (Plus only):**
- Renders after shipping address section
- Shows detailed breakdown with formatting
- Can display per-warehouse information
- Enhanced visual presentation

**Checkout Display:**
- Customer sees ONE shipping option (same as all stores)
- Extension shows additional breakdown
- Better visual clarity
- More transparency

**Note:** 
- The core shipping functionality works for ANY store with carrier calculated shipping enabled
- Plus stores get additional visual enhancements via Checkout UI Extension
- All stores return ONE combined rate (Shopify requirement)

## 8) Full File Tree

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
├── .eslintrc.json
├── .gitignore
├── next.config.js
├── next-env.d.ts
├── package.json
├── tsconfig.json
├── README.md
├── DEPLOYMENT.md
└── SPECIFICATION.md
```

## 9) COMPLETE SOURCE CODE

All source code files are present in the repository. See individual files for complete implementation.

## 10) Tests & Acceptance Criteria

### Installation Tests

- [ ] App installs via OAuth flow
- [ ] Shop record created in database
- [ ] Access token encrypted and stored
- [ ] Plus status detected correctly
- [ ] Webhooks registered successfully

### Configuration Tests

- [ ] Locations list loads from Shopify
- [ ] Settings can be created/updated/deleted
- [ ] Settings persist in database
- [ ] Validation works correctly
- [ ] Priority ordering functions

### Shipping Calculation Tests

- [ ] Items grouped by location correctly
- [ ] Inventory-based assignment works
- [ ] Priority-based assignment works
- [ ] Fallback logic assigns to default location
- [ ] Shipping costs calculated accurately
- [ ] ETAs included in rates
- [ ] Breakdown formatted correctly

### Checkout Display Tests

- [ ] Rates appear in checkout
- [ ] Non-Plus: Breakdown visible in description
- [ ] Plus: Extension shows breakdown
- [ ] Formatting is clear and readable
- [ ] Single rate returned (Shopify requirement)

### Webhook Tests

- [ ] App uninstall deactivates shop
- [ ] Shop update updates Plus status
- [ ] HMAC verification works
- [ ] Errors handled gracefully

### Security Tests

- [ ] OAuth flow secure
- [ ] Tokens encrypted properly
- [ ] Webhook HMAC verification works
- [ ] CarrierService HMAC verification works
- [ ] No secrets in code
- [ ] CSRF protection active

## 11) Deployment Guide

### Prerequisites

1. Heroku account
2. PostgreSQL (Heroku Postgres addon)
3. Shopify Partner account
4. Shopify CLI installed: `npm install -g @shopify/cli @shopify/theme`
5. Git repository

### Deployment Guide
**NOTE: Hosting has migrated to Render.**

1.  **Environment Variables**: Ensure all standard variables (SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SCOPES, HOST, etc.) are set in the Render dashboard.
2.  **Build Command**: `npm run build`
3.  **Start Command**: `npm start`
4.  **Database**: Connect to a Render-supported PostgreSQL instance or external provider.

