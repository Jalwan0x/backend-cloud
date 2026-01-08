# Admin Dashboard Setup

## Security Configuration

The admin dashboard is protected by authentication and rate limiting. Only authorized shops can access it.

### Environment Variable

Add the following environment variable to your Heroku config:

```bash
ADMIN_SHOP_DOMAINS=your-admin-shop.myshopify.com,another-admin-shop.myshopify.com
```

**Important Security Notes:**
- Only add shop domains that should have admin access
- Separate multiple domains with commas
- The shop domain must match exactly (case-insensitive)
- Only shops that have installed the app can access the admin dashboard

### Setting Up Admin Access

1. **Identify your admin shop(s)**
   - These are the Shopify stores that should have access to view all customer data
   - Typically, this would be your own development or partner store

2. **Add to Heroku config**
   ```bash
   heroku config:set ADMIN_SHOP_DOMAINS=your-admin-shop.myshopify.com
   ```

   For multiple admin shops:
   ```bash
   heroku config:set ADMIN_SHOP_DOMAINS=shop1.myshopify.com,shop2.myshopify.com
   ```

3. **Verify access**
   - Install the app on your admin shop
   - Navigate to `/admin?shop=your-admin-shop.myshopify.com` from within the Shopify admin
   - You should see the admin dashboard

### Security Features

1. **Authentication**
   - Only shops listed in `ADMIN_SHOP_DOMAINS` can access the admin API
   - Shop must be active and have a valid session
   - All access attempts are logged

2. **Rate Limiting**
   - 30 requests per minute per shop
   - Prevents abuse and brute force attacks
   - Returns 429 status code when limit exceeded

3. **Security Headers**
   - X-Content-Type-Options: nosniff
   - X-Frame-Options: DENY
   - X-XSS-Protection: 1; mode=block
   - Referrer-Policy: strict-origin-when-cross-origin

4. **Data Protection**
   - No sensitive data (access tokens, etc.) is exposed
   - Only shop metadata and configuration counts are shown
   - All errors return generic messages to prevent information leakage

### Accessing the Admin Dashboard

1. Open your Shopify admin
2. Navigate to Apps > Cloudship
3. The admin dashboard is accessible at `/admin` (only for authorized shops)
4. Or directly: `https://your-app-url.herokuapp.com/admin?shop=your-admin-shop.myshopify.com`

### Troubleshooting

**Error: "Unauthorized access"**
- Check that your shop domain is in `ADMIN_SHOP_DOMAINS`
- Verify the shop has installed the app
- Ensure the shop is active in the database

**Error: "Too many requests"**
- You've exceeded the rate limit (30 requests/minute)
- Wait a minute and try again

**Error: "Shop parameter is required"**
- Access the page from within the Shopify admin, not directly
- The `shop` query parameter is required for authentication
