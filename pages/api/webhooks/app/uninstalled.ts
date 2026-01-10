import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { verifyWebhook } from '@/lib/webhook-verification';
import { unregisterCarrierService } from '@/lib/carrier-service-registration';
import getRawBody from 'raw-body';

// Disable default body parser to verify HMAC
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawBodyBuffer = await getRawBody(req);
    const rawBody = rawBodyBuffer.toString('utf8');

    const hmac = req.headers['x-shopify-hmac-sha256'] as string;
    const shop = req.headers['x-shopify-shop-domain'] as string;

    if (!shop) {
      return res.status(400).json({ error: 'Shop header is required' });
    }

    if (!verifyWebhook(rawBody, hmac)) {
      console.warn(`[Webhook] Invalid signature for topic app/uninstalled shop ${shop}`);
      // Return 401 only on actual signature mismatch
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    // Parse verified body
    const body = JSON.parse(rawBody);

    console.log(`[Webhook] Processing uninstall for ${shop}`);

    // CRITICAL: Deactivate shop FIRST to prevent any new requests from processing
    // CRITICAL: Deactivate shop AND revoke token to prevent reuse
    await prisma.shop.update({
      where: { shopDomain: shop },
      data: {
        isActive: false,
        accessToken: "REVOKED", // Explicit revocation
        scopes: ""
      },
    });

    // Send 200 OK immediately - Shopify doesn't care about the rest
    res.status(200).json({ success: true });

    // Background Cleanup (Fire and forget from request perspective)
    (async () => {
      try {
        await unregisterCarrierService(shop);
      } catch (e: any) {
        console.warn(`[Webhook] Carrier service cleanup failed for ${shop} (expected):`, e.message);
      }

      try {
        const shopRecord = await prisma.shop.findUnique({ where: { shopDomain: shop } });
        if (shopRecord) {
          await prisma.locationSetting.deleteMany({ where: { shopId: shopRecord.id } });
          await prisma.webhook.deleteMany({ where: { shopId: shopRecord.id } });
        }
      } catch (e: any) {
        console.error(`[Webhook] DB cleanup failed for ${shop}:`, e.message);
      }
    })();

  } catch (error: any) {
    console.error('App uninstalled webhook error:', error);
    // If headers sent, we can't send error, but usually we haven't yet if generic error
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Webhook processing failed' });
    }
  }
}
