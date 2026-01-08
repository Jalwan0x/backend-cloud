# Deployment Guide

**Hosting Provider:** Render
**App URL:** https://backend-cloud-jzom.onrender.com

## Deployment Steps

1.  **Codebase**: Ensure code is pushed to the GitHub repository: https://github.com/Jalwan0x/backend-cloud
2.  **Render Service**:
    - Connect the GitHub repository to a new Web Service on Render.
    - **Build Command:** `npm run build`
    - **Start Command:** `npm start`
    - **Environment Variables:**
        - `SHOPIFY_API_KEY`: (Your Client ID)
        - `SHOPIFY_API_SECRET`: (Your Secret)
        - `SCOPES`: `read_products,write_products,read_orders,write_orders,read_inventory,read_shipping,write_shipping`
        - `HOST`: `https://backend-cloud-jzom.onrender.com`
        - `SHOPIFY_APP_URL`: `https://backend-cloud-jzom.onrender.com`
        - `DATABASE_URL`: (Your PostgreSQL Connection String)
        - `ENCRYPTION_KEY`: (Your generated key)
        - `NODE_ENV`: `production`

3.  **Shopify Configuration**:
    - Update `shopify.app.toml` with the Render URL (Completed).
    - Run `shopify app deploy` to update the extension and app URLs on Shopify.

## Post-Deployment Verification

1.  **OAuth**: Visit `https://backend-cloud-jzom.onrender.com/api/auth/begin?shop=your-store.myshopify.com` to verify installation flow.
2.  **Webhooks**: Verify `app/uninstalled` and `shop/update` webhooks are registered.
3.  **CarrierService**: Verify the endpoint is accessible at `https://backend-cloud-jzom.onrender.com/api/shipping-rates`.
4.  **Checkout UI Extension**: Test checkout on a Plus store to see the shipping breakdown.

2. PostgreSQL addon (Heroku Postgres)
3. Shopify Partner account
4. Shopify CLI installed: `npm install -g @shopify/cli @shopify/theme`
5. Git repository

## Step 1: Prepare Heroku App

```bash
# Login to Heroku
heroku login

# Create Heroku app
heroku create your-cloudship-app

# Add PostgreSQL addon
heroku addons:create heroku-postgresql:mini

# Get database URL
heroku config:get DATABASE_URL
```

## Step 2: Configure Environment Variables

```bash
# Set all required environment variables
heroku config:set SHOPIFY_API_KEY=your_shopify_api_key
heroku config:set SHOPIFY_API_SECRET=your_shopify_api_secret
heroku config:set SHOPIFY_APP_URL=https://your-cloudship-app.herokuapp.com
heroku config:set SCOPES="read_products,write_products,read_orders,write_orders,read_inventory,read_shipping,write_shipping"
heroku config:set ENCRYPTION_KEY=your_32_character_or_longer_encryption_key_here
heroku config:set NEXT_PUBLIC_SHOPIFY_API_KEY=your_shopify_api_key
heroku config:set NODE_ENV=production

# DATABASE_URL is automatically set by Heroku Postgres addon
```

Generate a secure encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 3: Deploy to Heroku

```bash
# Initialize git if not already done
git init
git add .
git commit -m "Initial commit"

# Add Heroku remote
heroku git:remote -a your-cloudship-app

# Deploy
git push heroku main

# If using a different branch:
git push heroku your-branch:main
```

## Step 4: Run Database Migrations

```bash
# Run Prisma migrations on Heroku
heroku run npm run db:push

# Generate Prisma client
heroku run npm run db:generate
```

## Step 5: Configure Shopify App

### In Shopify Partner Dashboard:

1. **App Settings:**
   - App URL: `https://your-cloudship-app.herokuapp.com`
   - Allowed redirection URL(s): `https://your-cloudship-app.herokuapp.com/api/auth/callback`

2. **App Setup:**
   - Enable "CarrierService API"
   - Configure scopes:
     - read_products
     - write_products
     - read_orders
     - write_orders
     - read_inventory
     - read_shipping
     - write_shipping

3. **Webhooks (Optional - App registers automatically):**
   - `app/uninstalled`: `https://your-cloudship-app.herokuapp.com/api/webhooks/app/uninstalled`
   - `shop/update`: `https://your-cloudship-app.herokuapp.com/api/webhooks/shop/update`

## Step 6: Register CarrierService (After Install)

After a merchant installs the app, register the CarrierService via Shopify Admin API:

```bash
# Using Shopify CLI or Admin API
# The CarrierService URL format is:
# https://your-cloudship-app.herokuapp.com/api/shipping-rates?shop={shop}
```

You can create a script to register it automatically after OAuth callback, or use Shopify CLI:

```bash
shopify app generate extension
# Select "Checkout UI Extension"
```

## Step 7: Deploy Checkout UI Extension

```bash
# Navigate to extensions directory
cd extensions/checkout-ui-extension

# Deploy extension
shopify app deploy

# Or use Shopify CLI from root
shopify app deploy --path extensions/checkout-ui-extension
```

## Step 8: Test Installation

1. Install the app on a dev store
2. Verify OAuth flow completes
3. Check that shop record is created in database
4. Configure location settings
5. Add items to cart from different locations
6. Test checkout shipping rates

## Step 9: Monitor Logs

```bash
# View Heroku logs
heroku logs --tail

# View specific logs
heroku logs --tail --app your-cloudship-app
```

## Troubleshooting

### Database Connection Issues
```bash
# Check database status
heroku pg:info

# Reset database (WARNING: deletes all data)
heroku pg:reset DATABASE_URL
heroku run npm run db:push
```

### Environment Variables
```bash
# List all config vars
heroku config

# Get specific var
heroku config:get SHOPIFY_API_KEY

# Remove var
heroku config:unset VARIABLE_NAME
```

### Build Failures
```bash
# Check build logs
heroku logs --tail

# Common issues:
# - Missing environment variables
# - Database connection issues
# - TypeScript errors
# - Missing dependencies
```

### Shopify Integration Issues
- Verify app URL matches Heroku URL
- Check OAuth callback URL is correct
- Ensure scopes are properly configured
- Verify CarrierService endpoint is accessible

## Production Checklist

- [ ] Heroku app created and deployed
- [ ] PostgreSQL addon added
- [ ] All environment variables set
- [ ] Database migrations run
- [ ] Shopify app configured in Partner Dashboard
- [ ] App URL and callback URL set correctly
- [ ] CarrierService enabled
- [ ] Webhooks configured
- [ ] Checkout UI Extension deployed (if using)
- [ ] Test installation on dev store
- [ ] Verify shipping calculations work
- [ ] Monitor logs for errors

## Scaling Considerations

- Upgrade Heroku Postgres plan for production traffic
- Consider Redis for caching shipping calculations
- Monitor API rate limits
- Set up error tracking (Sentry, etc.)
- Configure proper logging
- Set up monitoring and alerts

## Support

For issues or questions, check:
- Heroku status: https://status.heroku.com
- Shopify API status: https://status.shopify.com
- App logs: `heroku logs --tail`
