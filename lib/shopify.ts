import '@shopify/shopify-api/adapters/node';
import { shopifyApi, LATEST_API_VERSION, Session, BillingInterval } from '@shopify/shopify-api';
import { prisma } from './db';
import { encrypt, decrypt } from './encryption';

if (!process.env.SHOPIFY_API_KEY || !process.env.SHOPIFY_API_SECRET) {
  throw new Error('SHOPIFY_API_KEY and SHOPIFY_API_SECRET must be set');
}

console.log('[Shopify Config] Initializing Shopify API client...');

const envScopes = process.env.SCOPES || 'read_products,write_products,read_orders,write_orders,read_inventory,read_shipping,write_shipping,read_locations';
const scopes = envScopes.split(',');
if (!scopes.includes('read_locations')) {
  scopes.push('read_locations');
}

// Managed Pricing Config
const PLAN_NAME = process.env.SHOPIFY_PLAN_NAME || 'Pro Plan';
const PLAN_PRICE = parseFloat(process.env.SHOPIFY_PLAN_PRICE || '7.00');

export const billingConfig = {
  [PLAN_NAME]: {
    amount: PLAN_PRICE,
    currencyCode: 'USD',
    interval: BillingInterval.Every30Days,
    trialDays: 7,
  },
};

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: scopes,
  hostName: process.env.SHOPIFY_APP_URL?.replace(/https?:\/\//, '') || process.env.HOST?.replace(/https?:\/\//, '') || 'backend-cloud-jzom.onrender.com',
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
  billing: billingConfig as any,
});

console.log('[Shopify Config] Shopify API client initialized successfully');

export async function getShopifySession(shopDomain: string): Promise<Session | null> {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
  });

  if (!shop || !shop.isActive) {
    return null;
  }

  let accessToken;
  try {
    accessToken = decrypt(shop.accessToken);
  } catch (error) {
    console.error(`[getShopifySession] Failed to decrypt token for shop ${shopDomain}. Error: ${(error as any).message}`);
    // We do not set needsReauth here anymore to avoid schema conflicts if not generated
    return null;
  }

  return new Session({
    id: `offline_${shop.shopDomain}`,
    shop: shopDomain,
    state: shop.id,
    isOnline: false,
    accessToken,
    scope: shop.scopes,
  });
}

export async function storeShopSession(session: Session): Promise<void> {
  try {
    const encryptedToken = encrypt(session.accessToken || '');
    const shopifyId = session.shop.replace('.myshopify.com', '');

    console.log(`[storeShopSession] Upserting shop: ${session.shop}, shopifyId: ${shopifyId}`);

    const result = await prisma.shop.upsert({
      where: { shopDomain: session.shop },
      update: {
        accessToken: encryptedToken,
        scopes: session.scope || '',
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        shopDomain: session.shop,
        shopifyId: shopifyId,
        accessToken: encryptedToken,
        scopes: session.scope || '',
        isActive: true,
      },
    });

    console.log(`[storeShopSession] Shop ${session.shop} stored/updated with ID: ${result.id}`);
  } catch (error: any) {
    console.error(`[storeShopSession] ERROR storing shop session:`, error);
    throw error;
  }
}
