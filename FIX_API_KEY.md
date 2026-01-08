# Fix API Key Mismatch

## Problem
The API key `dc889cc0c87af2509443b0607283be17` doesn't match your Shopify app.

## Solution

### Step 1: Get the Correct API Key from Partner Dashboard

1. Go to https://partners.shopify.com
2. Click on your app "cloudship"
3. Go to **Settings** → **App setup**
4. Find the **API credentials** section
5. Copy the **API key** (Client ID)

### Step 2: Update Heroku Environment Variables

Replace `YOUR_ACTUAL_API_KEY` with the API key from Step 1:

```bash
heroku config:set SHOPIFY_API_KEY=YOUR_ACTUAL_API_KEY --app cloudship
heroku config:set NEXT_PUBLIC_SHOPIFY_API_KEY=YOUR_ACTUAL_API_KEY --app cloudship
```

### Step 3: Get the API Secret

In the same Partner Dashboard page, copy the **API secret key**.

Then set it:

```bash
heroku config:set SHOPIFY_API_SECRET=YOUR_ACTUAL_API_SECRET --app cloudship
```

### Step 4: Update shopify.app.toml

Update the `client_id` in `shopify.app.toml` to match:

```toml
client_id = "YOUR_ACTUAL_API_KEY"
```

### Step 5: Verify

After updating, check:

```bash
heroku config:get SHOPIFY_API_KEY --app cloudship
```

It should match the API key in Partner Dashboard.

### Step 6: Try OAuth Again

After updating, try the OAuth URL again:
```
https://cloudship-38accbc9b566.herokuapp.com/api/auth/begin?shop=clouship-test.myshopify.com
```

## Important Notes

- The API key in `shopify.app.toml` must match the API key in Heroku environment variables
- The API key must match the app in Partner Dashboard
- After changing environment variables, Heroku will automatically restart the app
