import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { verifyWebhook } from '@/lib/webhook-verification';
import { unregisterCarrierService } from '@/lib/carrier-service-registration';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const hmac = req.headers['x-shopify-hmac-sha256'] as string;
    const shop = req.headers['x-shopify-shop-domain'] as string;

    if (!shop) {
      return res.status(400).json({ error: 'Shop header is required' });
    }

    const rawBody = JSON.stringify(req.body);
    if (!verifyWebhook(rawBody, hmac)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    // CRITICAL: Deactivate shop FIRST to prevent any new requests from processing
    await prisma.shop.update({
      where: { shopDomain: shop },
      data: { isActive: false },
    });

    console.log(`Shop ${shop} deactivated - app features disabled immediately`);

    // Try to unregister CarrierService (may fail if token is already revoked, that's OK)
    try {
      await unregisterCarrierService(shop);
      console.log(`CarrierService unregistered for ${shop}`);
    } catch (error: any) {
      console.warn('Failed to unregister CarrierService during uninstall (token may be revoked):', error.message);
      // This is expected - access token is revoked on uninstall
    }

    // Delete all location settings and webhooks
    const shopRecord = await prisma.shop.findUnique({
      where: { shopDomain: shop },
      select: { id: true },
    });

    if (shopRecord) {
      try {
        // Delete location settings
        await prisma.locationSetting.deleteMany({
          where: { shopId: shopRecord.id },
        });

        // Delete webhooks
        await prisma.webhook.deleteMany({
          where: { shopId: shopRecord.id },
        });

        console.log(`Deleted all settings and webhooks for ${shop}`);
      } catch (deleteError: any) {
        console.error(`Error deleting settings for ${shop}:`, deleteError.message);
        // Continue even if deletion fails - shop is already deactivated
      }
    }

    console.log(`App uninstalled for ${shop} - all features disabled`);

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('App uninstalled webhook error:', error);
    res.status(500).json({ error: error.message || 'Webhook processing failed' });
  }
}
