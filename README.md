# Cloudship App

A production-ready Shopify app that provides per-warehouse shipping transparency for both Shopify Plus and non-Plus merchants.

## Problem Statement

Shopify checkout combines shipping rates when items come from multiple warehouses (Shopify Locations). Customers see a single shipping cost and delivery time even when:
- One item ships fast (1–2 days from a local warehouse)
- Another ships slow (7–10 days from an international warehouse)

This causes confusion, abandoned carts, and merchant frustration.

## Solution

Cloudship detects which cart items belong to which Shopify Location, calculates shipping cost + ETA per warehouse, and clearly indicates fast vs slow shipments while respecting Shopify's platform limitations.

## Features

### 1. Merchant Admin UI
- Built with Polaris + App Bridge
- Merchants configure shipping cost + ETA per Shopify Location
- Store data in PostgreSQL (Prisma)
- Toggle options for display preferences

### 2. Cart & Shipping Logic
- Groups cart items by Shopify Location
- Calculates shipping independently per group
- Deterministic grouping with safe fallbacks

### 3. Checkout Display
**All Stores (with carrier calculated shipping enabled):**
- Returns ONE combined shipping rate (Shopify requirement)
- Appends a readable breakdown in the rate name/description
- Works for any store type, not just Plus

**Shopify Plus (additional feature):**
- Can use Checkout UI Extensions for enhanced visual display
- Shows separate shipments with warehouse name, shipping cost, and delivery estimate

### 4. Shipping Rate Engine
- Uses CarrierService API
- Shopify receives a single combined rate for non-Plus stores
- Internally preserves per-warehouse breakdown

## Tech Stack

- **Frontend:** Next.js 14, React, TypeScript
- **UI:** Shopify Polaris, App Bridge
- **Backend:** Next.js API Routes, Node.js
- **Database:** PostgreSQL + Prisma ORM
- **Shopify APIs:** Admin API, CarrierService, Webhooks
- **Extensions:** Checkout UI Extensions (Plus only)
- **Hosting:** Render

## Setup

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Shopify Partner account and app setup
- Render account
- Shopify CLI installed

### Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file with:
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/cloudship
   SHOPIFY_API_KEY=your_shopify_api_key
   SHOPIFY_API_SECRET=your_shopify_api_secret
   SHOPIFY_APP_URL=https://backend-cloud-jzom.onrender.com
   SCOPES=read_products,write_products,read_orders,write_orders,read_inventory,read_shipping,write_shipping
   ENCRYPTION_KEY=your_32_character_or_longer_encryption_key_here
   NEXT_PUBLIC_SHOPIFY_API_KEY=your_shopify_api_key
   ```

3. **Set up database:**
   ```bash
   npm run db:generate
   npm run db:push
   ```

4. **Configure your Shopify app:**
   - In Partner Dashboard, set App URL to your Render URL: `https://backend-cloud-jzom.onrender.com`
   - Set Allowed redirection URL(s) to: `https://backend-cloud-jzom.onrender.com/api/auth/callback`
   - Enable CarrierService API in app settings

5. **Run development server (using Shopify CLI):**
   ```bash
   npm run dev
   # or
   shopify app dev
   ```
   
   This will:
   - Create the app on Shopify (if first time)
   - Set up OAuth automatically
   - Register webhooks
   - Start local dev server with tunnel

## Development with Shopify CLI

This app uses the official Shopify CLI workflow:

```bash
# Start development (creates app if needed)
npm run dev

# Deploy extensions
npm run deploy

# View app info
shopify app info
```

See `SHOPIFY_CLI_SETUP.md` for detailed Shopify CLI usage.

## Deployment

See DEPLOYMENT.md for complete deployment instructions.

## Shopify Limitations & Assumptions

### All Stores (with carrier calculated shipping)
- **Works for ANY store** that has carrier calculated shipping enabled
- **Must** return a single combined shipping rate via CarrierService (Shopify requirement)
- Breakdown is shown in the rate name/description field
- This is a Shopify platform limitation, not an app limitation

### Shopify Plus Stores (additional features)
- **Can** use Checkout UI Extensions for enhanced visual breakdown
- Same core functionality as all stores, with additional display options

### Assumptions
- Inventory is properly tracked in Shopify Locations
- Each product variant has inventory assigned to locations
- Merchants have configured locations correctly in Shopify
- Fallback logic assigns items to first available location if inventory data unavailable

## Security

- ✅ OAuth install flow
- ✅ Encrypted access token storage (AES-256-GCM)
- ✅ Webhook HMAC verification
- ✅ Minimal scopes only
- ✅ No secrets in code
- ✅ CSRF protection via App Bridge
- ✅ XSS protection via React/Polaris

## License

Private - All rights reserved
