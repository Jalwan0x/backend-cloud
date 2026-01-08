# Setup Shopify App - Quick Guide

**Important:** This app works for ANY store with carrier calculated shipping enabled, not just Plus stores. Plus stores get additional visual enhancements via Checkout UI Extension.

## Option 1: Create via Partner Dashboard (Recommended)

1. Go to https://partners.shopify.com
2. Click "Apps" → "Create app"
3. Choose "Custom app"
4. Fill in:
   - **App name:** `cloudship`
   - **App URL:** `https://cloudship-38accbc9b566.herokuapp.com`
   - **Allowed redirection URL(s):** `https://cloudship-38accbc9b566.herokuapp.com/api/auth/callback`
5. Enable "CarrierService API" in app setup
6. Copy the **API Key** and **API Secret**
7. Run these commands:

```bash
heroku config:set SHOPIFY_API_KEY=your_api_key --app cloudship
heroku config:set SHOPIFY_API_SECRET=your_api_secret --app cloudship
heroku config:set NEXT_PUBLIC_SHOPIFY_API_KEY=your_api_key --app cloudship
```

## Option 2: Create via Partner API (Advanced)

1. Get your Partner API token from: https://partners.shopify.com/settings/api
2. Set it as environment variable:
   ```bash
   set SHOPIFY_PARTNER_API_TOKEN=your_token
   ```
3. Run the script:
   ```bash
   node create-shopify-app.js
   ```
4. The script will output the API credentials - set them on Heroku as shown above.

## After Setup

Once the API keys are set, your app will be ready! You can:
- Install it on a dev store
- Test the shipping calculations
- Deploy the checkout extension (for Plus stores)
