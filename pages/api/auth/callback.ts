import type { NextApiRequest, NextApiResponse } from 'next';
import { shopify } from '@/lib/shopify';
import { prisma } from '@/lib/db';
import { registerWebhooks } from '@/lib/webhook-registration';
import { registerCarrierService } from '@/lib/carrier-service-registration';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // 1. Trigger Shopify's OAuth Callback
    const { session } = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    // 2. MANDATORY FIX: UPSERT SHOP IMMEDIATELY
    const shop = session.shop.toLowerCase();
    console.log("🔥 REAL OAUTH CALLBACK HIT", shop);

    await prisma.shop.upsert({
      where: { shopDomain: shop }, // Using shopDomain as the unique key in schema
      update: {
        accessToken: session.accessToken,
        updatedAt: new Date(),
      },
      create: {
        shopDomain: shop,
        shopifyId: shop.replace('.myshopify.com', ''), // Required by schema
        accessToken: session.accessToken || '',
        scopes: session.scope || '',
        isActive: true,
      },
    });

    console.log("✅ SHOP SAVED", shop);
    const count = await prisma.shop.count();
    console.log("🧪 SHOP COUNT", count);

    // 3. Register webhooks & carrier service (non-blocking)
    registerWebhooks(shop).catch(e => console.error('Webhook registration failed:', e));
    registerCarrierService(shop).catch(e => console.error('CarrierService registration failed:', e));

    // 4. Redirect to app
    const redirectUrl = `https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY}`;
    res.redirect(redirectUrl);

  } catch (error: any) {
    console.error('OAuth callback error:', error);

    // DEBUG: Detailed logging to diagnose InvalidOAuthError
    console.log('[Debug] Request Query:', JSON.stringify(req.query, null, 2));
    console.log('[Debug] Request Headers (Sanitized):', JSON.stringify({
      host: req.headers.host,
      cookie: req.headers.cookie,
      referer: req.headers.referer,
      'user-agent': req.headers['user-agent']
    }, null, 2));

    // Explicitly check for cookie presence
    const cookies = req.headers.cookie || '';
    const hasShopifyState = cookies.includes('shopify_app_state');
    console.log(`[Debug] shopify_app_state cookie present: ${hasShopifyState}`);

    if (error.message && error.message.includes('Invalid OAuth callback')) {
      console.error('[Debug] CRITICAL: State mismatch or cookie missing.');
    }

    res.status(500).json({ error: error.message || 'Authentication failed' });
  }
}
