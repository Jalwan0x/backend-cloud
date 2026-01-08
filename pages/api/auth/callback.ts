import type { NextApiRequest, NextApiResponse } from 'next';
import { shopify } from '@/lib/shopify';
import { storeShopSession } from '@/lib/shopify';
import { prisma } from '@/lib/db';
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
    console.log(`[OAuth Callback] Request URL: ${req.url}`);
    console.log(`[OAuth Callback] Request query:`, req.query);
    console.log(`[OAuth Callback] Request cookies:`, req.headers.cookie);
    console.log(`[OAuth Callback] Shopify API Key: ${process.env.SHOPIFY_API_KEY?.substring(0, 10)}...`);
    console.log(`[OAuth Callback] Shopify API Secret: ${process.env.SHOPIFY_API_SECRET ? 'SET' : 'NOT SET'}`);
    
    // Check if we have the shop parameter in query (from Shopify redirect)
    const shopFromQuery = req.query.shop as string;
    if (!shopFromQuery) {
      console.error('[OAuth Callback] No shop parameter in query. Redirecting to OAuth begin...');
      // If no shop in query and no cookie, redirect to begin
      return res.redirect(`/api/auth/begin?shop=clouship-test.myshopify.com`);
    }
    
    const callbackResponse = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const { session } = callbackResponse;
    console.log(`[OAuth Callback] OAuth successful for shop: ${session.shop}`);

    // Store session in database BEFORE redirect
    console.log(`[OAuth Callback] Storing session for shop: ${session.shop}`);
    try {
      await storeShopSession(session);
      console.log(`[OAuth Callback] Session stored successfully for ${session.shop}`);
      
      // Verify it was stored
      const verifyShop = await prisma.shop.findUnique({
        where: { shopDomain: session.shop },
      });
      if (!verifyShop) {
        throw new Error(`Shop was not stored in database: ${session.shop}`);
      }
      console.log(`[OAuth Callback] Verified shop in database: ${verifyShop.id}`);
    } catch (storeError: any) {
      console.error(`[OAuth Callback] ERROR storing session:`, storeError);
      console.error(`[OAuth Callback] Error message:`, storeError.message);
      console.error(`[OAuth Callback] Error code:`, storeError.code);
      console.error(`[OAuth Callback] Error stack:`, storeError.stack);
      // Don't redirect if storage failed
      return res.status(500).json({ 
        error: 'Failed to store shop session',
        details: storeError.message,
        shop: session.shop,
      });
    }

    // Check if shop supports split shipping (Advanced or Plus)
    const client = new shopify.clients.Graphql({ session });
    const shopQuery = `
      query {
        shop {
          id
          plan {
            displayName
          }
        }
      }
    `;

    const shopResponse = await client.query({
      data: { query: shopQuery },
    });

    const shopData = shopResponse.body as any;
    const planName = shopData.data?.shop?.plan?.displayName || '';
    console.log(`[OAuth Callback] Shop plan for ${session.shop}: ${planName}`);
    // Advanced Shopify and Shopify Plus both support split shipping
    const isPlus = planName === 'Shopify Plus' || planName === 'Advanced Shopify';

    // Update shop Plus status (we use isPlus to mean "supports split shipping")
    try {
      const updatedShop = await prisma.shop.update({
        where: { shopDomain: session.shop },
        data: { isPlus },
      });
      console.log(`[OAuth Callback] Shop updated in database: ${updatedShop.id}, isPlus: ${isPlus}`);
    } catch (updateError: any) {
      console.error(`[OAuth Callback] ERROR updating shop Plus status:`, updateError);
      // Don't throw - shop is already stored, this is just a bonus update
    }

    // Register webhooks
    try {
      await registerWebhooks(session.shop);
    } catch (error) {
      console.error('Failed to register webhooks:', error);
    }

    // Register CarrierService
    try {
      await registerCarrierService(session.shop);
    } catch (error) {
      console.error('Failed to register CarrierService:', error);
    }

    // Redirect to app
    const redirectUrl = `https://${session.shop}/admin/apps/${process.env.SHOPIFY_API_KEY}`;
    res.redirect(redirectUrl);
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: error.message || 'Authentication failed' });
  }
}
