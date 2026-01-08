# Verify App Installation

## Current Configuration

✅ **shopify.app.toml** - Correctly configured:
- Client ID: `dc889cc0c87af2509443b0607283be17`
- App URL: `https://backend-cloud-jzom.onrender.com`
- Dev Store: `clouship-test.myshopify.com`

✅ **Render Environment Variables** - All set:
- SHOPIFY_API_KEY: `dc889cc0c87af2509443b0607283be17`
- SHOPIFY_API_SECRET: `your_shopify_api_secret_here`
- NEXT_PUBLIC_SHOPIFY_API_KEY: `dc889cc0c87af2509443b0607283be17`

## Partner Dashboard Settings

Please verify these settings in your Partner Dashboard match:

1. **App URL**: `https://backend-cloud-jzom.onrender.com`
2. **Allowed redirection URL(s)**: `https://backend-cloud-jzom.onrender.com/api/auth/callback`
3. **CarrierService API**: Enabled
4. **Scopes**: 
   - read_products
   - write_products
   - read_orders
   - write_orders
   - read_inventory
   - read_shipping
   - write_shipping

## Test Installation

1. **Install URL**: 
   ```
   https://backend-cloud-jzom.onrender.com/api/auth/begin?shop=clouship-test.myshopify.com
   ```

2. **Or from Partner Dashboard**:
   - Go to your app
   - Click "Install app"
   - Select `clouship-test.myshopify.com`

## Troubleshooting

If you see an error after installation:

1. Check Render logs in the dashboard
2. Verify Partner Dashboard settings match above
3. Ensure CarrierService API is enabled
4. Check that redirect URL is exactly: `https://backend-cloud-jzom.onrender.com/api/auth/callback`

The shopify.app.toml file is correctly configured and doesn't need to be updated - it already has the right client_id.
