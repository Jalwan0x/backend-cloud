import type { NextApiRequest, NextApiResponse } from 'next';
import { shopify } from '@/lib/shopify';
import { prisma } from '@/lib/db';
import { registerWebhooks } from '@/lib/webhook-registration';
import { registerCarrierService } from '@/lib/carrier-service-registration';

// Verification Log - File Load
console.log('--- OAUTH CALLBACK FILE LOADED ---');

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('OAUTH CALLBACK HIT - STARTING HANDLER');
    console.log(`[OAuth Callback] Request URL: ${req.url}`);

    // Check if we have the shop parameter in query
    const shopFromQuery = req.query.shop as string;
    if (!shopFromQuery) {
      console.error('[OAuth Callback] No shop parameter in query. Redirecting to OAuth begin...');
      return res.redirect(`/api/auth/begin?shop=clouship-test.myshopify.com`);
    }

    const callbackResponse = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const { session } = callbackResponse;

    // --- MANDATORY USER FIX START ---

    const shop = session.shop.toLowerCase();

    // Using prisma.shop.upsert exactly as requested (mapped to shopDomain)
    await prisma.shop.upsert({
      where: { shopDomain: shop },
      update: {
        accessToken: session.accessToken,
        updatedAt: new Date(),
      },
      create: {
        shopDomain: shop,
        shopifyId: shop.replace('.myshopify.com', ''), // Needed for schema validation
        accessToken: session.accessToken || '',
        scopes: session.scope || '', // Needed for schema
        isActive: true, // Needed for schema
      },
    });

    console.log("🔥 REAL OAUTH CALLBACK HIT", session.shop);
    console.log("✅ SHOP SAVED TO DB", shop);
    const count = await prisma.shop.count();
    console.log("🧪 SHOP COUNT AFTER SAVE", count);

    // --- MANDATORY USER FIX END ---

    // Register webhooks (non-blocking)
    registerWebhooks(shop).catch(e => console.error('Webhook registration failed:', e));

    // Register CarrierService (non-blocking)
    registerCarrierService(shop).catch(e => console.error('CarrierService registration failed:', e));

    // Redirect to app
    const redirectUrl = `https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY}`;
    res.redirect(redirectUrl);

  } catch (error: any) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: error.message || 'Authentication failed' });
  }
}
