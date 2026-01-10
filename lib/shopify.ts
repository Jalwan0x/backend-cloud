import '@shopify/shopify-api/adapters/node';
import { shopifyApi, LATEST_API_VERSION, Session } from '@shopify/shopify-api';
import { prisma } from './db';
import { encrypt, decrypt } from './encryption';

if (!process.env.SHOPIFY_API_KEY || !process.env.SHOPIFY_API_SECRET) {
  throw new Error('SHOPIFY_API_KEY and SHOPIFY_API_SECRET must be set');
}

console.log('[Shopify Config] Initializing Shopify API client...');
console.log(`[Shopify Config] API Key: ${process.env.SHOPIFY_API_KEY?.substring(0, 10)}...`);
console.log(`[Shopify Config] API Secret: ${process.env.SHOPIFY_API_SECRET ? 'SET' : 'NOT SET'}`);
console.log(`[Shopify Config] App URL: ${process.env.SHOPIFY_APP_URL || 'NOT SET'}`);

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: (process.env.SCOPES || 'read_products,write_products,read_orders,write_orders,read_inventory,read_shipping,write_shipping').split(','),
  hostName: process.env.SHOPIFY_APP_URL?.replace(/https?:\/\//, '') || 'backend-cloud-jzom.onrender.com',
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
});

console.log('[Shopify Config] Shopify API client initialized successfully');

export async function getShopifySession(shopDomain: string): Promise<Session | null> {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
  });

  if (!shop || !shop.isActive) {
    return null;
  }

  // Fast fail if known bad (Optimized)
  if (shop.needsReauth) {
    console.log(`[getShopifySession] Shop ${shopDomain} flagged for re-auth. Skipping decryption.`);
    return null;
  }

  let accessToken;
  try {
    accessToken = decrypt(shop.accessToken);
  } catch (error) {
    console.error(`[getShopifySession] Failed to decrypt token for shop ${shopDomain}. Error: ${error.message}`);

    // Mark as needing re-auth to prevent future error logs
    await prisma.shop.update({
      where: { id: shop.id },
      data: { needsReauth: true },
    }).catch(e => console.error('[getShopifySession] Failed to set needsReauth flag:', e));

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
    console.log(`[storeShopSession] Database URL exists: ${!!process.env.DATABASE_URL}`);
    console.log(`[storeShopSession] Prisma client initialized: ${!!prisma}`);

    // Test database connection first
    try {
      await prisma.$connect();
      console.log(`[storeShopSession] Database connection successful`);
    } catch (connError: any) {
      console.error(`[storeShopSession] Database connection failed:`, connError);
      throw new Error(`Database connection failed: ${connError.message}`);
    }

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
    console.error(`[storeShopSession] Error details:`, {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
    });
    throw error;
  }
}
