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
    console.log('[OAuth Callback] Starting OAuth callback...');

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
    console.log(`[OAuth Callback] OAuth successful for shop: ${session.shop}`);

    // --- CRITICAL: PERSIST SHOP TO DB ---
    // User requested explicit inline logic to fix "0 shops" issue.
    // relying on storeShopSession was suspicious, so we do it here.
    console.log(`[OAuth Callback] Persisting shop to database: ${session.shop}`);

    try {
      const encryptedToken = encrypt(session.accessToken || '');
      const shopifyId = session.shop.replace('.myshopify.com', '');

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
          shopifyId: shopifyId, // Naive ID extraction if needed, or use specific ID from GraphQL if available later
          accessToken: encryptedToken,
          scopes: session.scope || '',
          isActive: true,
        },
      });

      console.log(`[OAuth Callback] Shop persisted successfully. ID: ${result.id}`);

    } catch (dbError: any) {
      console.error(`[OAuth Callback] CRITICAL DATABASE ERROR:`, dbError);
      return res.status(500).json({
        error: 'Failed to persist shop to database',
        details: dbError.message
      });
    }
    // ------------------------------------

    // Register webhooks (non-blocking)
    registerWebhooks(session.shop).catch(e => console.error('Webhook registration failed:', e));

    // Register CarrierService (non-blocking)
    registerCarrierService(session.shop).catch(e => console.error('CarrierService registration failed:', e));

    // Redirect to app
    const redirectUrl = `https://${session.shop}/admin/apps/${process.env.SHOPIFY_API_KEY}`;
    res.redirect(redirectUrl);

  } catch (error: any) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: error.message || 'Authentication failed' });
  }
}
