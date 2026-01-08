import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { verifyWebhook } from '@/lib/webhook-verification';

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

    const shopData = req.body as { plan_name?: string };
    // Advanced Shopify (plan_name: 'advanced') and Shopify Plus (plan_name: 'enterprise') both support split shipping
    const isPlus = shopData.plan_name === 'enterprise' || shopData.plan_name === 'advanced';

    // Update shop Plus status (we use isPlus to mean "supports split shipping")
    await prisma.shop.updateMany({
      where: { shopDomain: shop },
      data: { isPlus },
    });

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Shop update webhook error:', error);
    res.status(500).json({ error: error.message || 'Webhook processing failed' });
  }
}
