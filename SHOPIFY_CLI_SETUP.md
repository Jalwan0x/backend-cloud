# Shopify CLI Setup Guide

This app follows the official Shopify CLI workflow and structure.

## Project Structure

```
cloudship-app/
├── shopify.app.toml          # Shopify CLI configuration
├── extensions/               # Shopify extensions
│   └── checkout-ui-extension/
├── pages/                    # Next.js pages (web app)
├── lib/                      # Shared utilities
├── prisma/                   # Database schema
└── package.json
```

## Using Shopify CLI

### 1. Create the App (First Time)

The app will be created automatically when you run:

```bash
npm run dev
# or
shopify app dev
```

This will:
- Prompt you to create a new app on Shopify (if client_id is not set)
- Set up OAuth
- Register webhooks
- Start local development server with tunnel

### 2. Local Development

```bash
npm run dev
```

This uses `shopify app dev` which:
- Starts Next.js dev server
- Creates/uses ngrok tunnel
- Handles OAuth flow
- Registers webhooks automatically
- Watches for changes

### 3. Deploy Extensions

```bash
npm run deploy
# or
shopify app deploy
```

This deploys:
- Checkout UI Extension
- Any other extensions in the `extensions/` directory

### 4. View App Info

```bash
shopify app info
```

Shows:
- App name
- Client ID
- Extensions
- App URL

### 5. Generate New Extensions

```bash
shopify app generate extension
```

Follow prompts to create new extensions.

## Configuration

The `shopify.app.toml` file contains:
- App name and client ID
- Scopes
- Redirect URLs
- Webhook configuration
- Extension configuration

## Important Notes

1. **First Run**: When you first run `shopify app dev`, it will prompt you to create the app on Shopify. This is the official way to create apps.

2. **Client ID**: After the app is created, the `client_id` in `shopify.app.toml` will be automatically updated.

3. **Environment Variables**: For production (Render), you still need to set:
   - `SHOPIFY_API_KEY`
   - `SHOPIFY_API_SECRET`
   - `SHOPIFY_APP_URL`
   - Other env vars

4. **Local Development**: Shopify CLI handles:
   - Tunnel creation (ngrok)
   - OAuth flow
   - Webhook registration
   - Hot reloading

## Workflow

### Development
1. Run `npm run dev`
2. Shopify CLI creates app (if needed)
3. Install on dev store
4. Make changes
5. Test locally

### Production Deployment
1. Deploy to Render (via GitHub push)
2. Set environment variables on Render
3. Deploy extensions: `shopify app deploy`
4. App is live!

## Reference

- [Shopify CLI Documentation](https://shopify.dev/docs/apps/build/cli-for-apps)
- [Shopify App Configuration](https://shopify.dev/docs/apps/tools/cli/configuration)
