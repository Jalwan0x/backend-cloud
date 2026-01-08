// Script to create Shopify app via Partner API
// Note: This requires Partner API access token
// You can get this from: https://partners.shopify.com/settings/api

const https = require('https');

const PARTNER_API_TOKEN = process.env.SHOPIFY_PARTNER_API_TOKEN;
const APP_NAME = 'cloudship';
const APP_URL = 'https://cloudship-38accbc9b566.herokuapp.com';
const REDIRECT_URL = 'https://cloudship-38accbc9b566.herokuapp.com/api/auth/callback';

if (!PARTNER_API_TOKEN) {
  console.error('Error: SHOPIFY_PARTNER_API_TOKEN environment variable is required');
  console.error('Get your token from: https://partners.shopify.com/settings/api');
  process.exit(1);
}

const data = JSON.stringify({
  query: `
    mutation appCreate($app: AppCreateInput!) {
      appCreate(app: $app) {
        app {
          id
          apiKey
          apiSecretKeys {
            secret
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `,
  variables: {
    app: {
      title: APP_NAME,
      applicationUrl: APP_URL,
      redirectUrlWhitelist: [REDIRECT_URL],
    }
  }
});

const options = {
  hostname: 'partners.shopify.com',
  path: '/api/2024-01/graphql.json',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': PARTNER_API_TOKEN,
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    const result = JSON.parse(responseData);
    
    if (result.data?.appCreate?.app) {
      const app = result.data.appCreate.app;
      console.log('✅ App created successfully!');
      console.log('\nAPI Credentials:');
      console.log(`SHOPIFY_API_KEY=${app.apiKey}`);
      if (app.apiSecretKeys && app.apiSecretKeys.length > 0) {
        console.log(`SHOPIFY_API_SECRET=${app.apiSecretKeys[0].secret}`);
      }
      console.log('\nSet these on Heroku:');
      console.log(`heroku config:set SHOPIFY_API_KEY=${app.apiKey} --app cloudship`);
      if (app.apiSecretKeys && app.apiSecretKeys.length > 0) {
        console.log(`heroku config:set SHOPIFY_API_SECRET=${app.apiSecretKeys[0].secret} --app cloudship`);
      }
      console.log(`heroku config:set NEXT_PUBLIC_SHOPIFY_API_KEY=${app.apiKey} --app cloudship`);
    } else if (result.data?.appCreate?.userErrors?.length > 0) {
      console.error('❌ Errors creating app:');
      result.data.appCreate.userErrors.forEach(error => {
        console.error(`  - ${error.field}: ${error.message}`);
      });
    } else {
      console.error('❌ Failed to create app');
      console.error(JSON.stringify(result, null, 2));
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end();
