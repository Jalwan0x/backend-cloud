# OAuth Fix Instructions

## Problem
The OAuth callback (`/api/auth/callback`) is never being called, so shops aren't being stored in the database.

## Solution

### Option 1: Fix Callback URL in Partner Dashboard (Recommended)

1. Go to https://partners.shopify.com
2. Click on your app "cloudship"
3. Go to **Settings** → **App setup**
4. Scroll to **Allowed redirection URL(s)**
5. Make sure it's EXACTLY:
   ```
   https://cloudship-38accbc9b566.herokuapp.com/api/auth/callback
   ```
6. Click **Save**
7. **Uninstall** the app from your shop
8. **Reinstall** the app from Partner Dashboard
9. Watch Heroku logs for `[OAuth Callback]` messages

### Option 2: Manually Trigger OAuth

1. **Log in to admin page first:**
   - Go to: https://cloudship-38accbc9b566.herokuapp.com/admin
   - Password: `jalwanjalwan12`

2. **Then trigger OAuth:**
   - Go to: https://cloudship-38accbc9b566.herokuapp.com/api/admin/trigger-oauth?shop=clouship-test.myshopify.com
   - This will redirect you to Shopify OAuth

3. **Or use direct OAuth URL:**
   ```
   https://cloudship-38accbc9b566.herokuapp.com/api/auth/begin?shop=clouship-test.myshopify.com
   ```

### Option 3: Check Current Callback URL

The callback URL in your `shopify.app.toml` is:
```
https://cloudship-38accbc9b566.herokuapp.com/api/auth/callback
```

Make sure this EXACT URL is in your Partner Dashboard settings.

## Verification

After fixing, you should see in Heroku logs:
```
[OAuth Callback] Starting OAuth callback...
[OAuth Callback] OAuth successful for shop: clouship-test.myshopify.com
[storeShopSession] Upserting shop: clouship-test.myshopify.com
[OAuth Callback] Verified shop in database: ...
```

Then check `/api/admin/debug-db` - it should show shops > 0.
