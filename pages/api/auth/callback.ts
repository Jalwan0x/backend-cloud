import type { NextApiRequest, NextApiResponse } from 'next';
import { shopify } from '@/lib/shopify';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { registerWebhooks } from '@/lib/webhook-registration';
import { registerCarrierService } from '@/lib/carrier-service-registration';

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

    // Check if we have the shop parameter in query (from Shopify redirect)
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
    console.log(`[OAuth Callback] OAuth successful. Session Shop: '${session.shop}'`);

    // --- CRITICAL: SHOP NORMALIZATION & PERSISTENCE ---
    // Ensure strict consistency with Admin API expectations

    // 1. Normalize (Strip protocol, lowercase)
    // "ws1gnf-sz.myshopify.com" should remain "ws1gnf-sz.myshopify.com"
    const shop = session.shop.replace(/^https?:\/\//, "").toLowerCase();

    console.log("🟢 SAVING SHOP:", shop);

    try {
      const encryptedToken = encrypt(session.accessToken || '');
      // Shopify ID is the first part of the domain
      const shopifyId = shop.replace('.myshopify.com', '');

      // 2. Upsert using EXACT identifier
      const result = await prisma.shop.upsert({
        where: { shopDomain: shop },
        update: {
          accessToken: encryptedToken,
          scopes: session.scope || '',
          isActive: true,
          updatedAt: new Date(),
        },
        create: {
          shopDomain: shop,
          shopifyId: shopifyId,
          accessToken: encryptedToken,
          scopes: session.scope || '',
          isActive: true,
        },
      });

      console.log("🟢 SHOP SAVED SUCCESSFULLY:", result.shopDomain);

      // 3. Count Verification
      const count = await prisma.shop.count();
      console.log("🧪 SHOP COUNT NOW:", count);

      console.log('SHOP SAVED TO DB - ID:', result.id);

    } catch (dbError: any) {
      console.error(`[OAuth Callback] CRITICAL DATABASE ERROR:`, dbError);
      return res.status(500).json({
        error: 'Failed to persist shop to database',
        details: dbError.message
      });
    }
    // ------------------------------------

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
