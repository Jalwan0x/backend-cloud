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
            console.warn(`[Webhook] Invalid signature for topic app_subscriptions/update shop ${shop}`);
            return res.status(401).json({ error: 'Invalid webhook signature' });
        }

        const payload = req.body;
        const { status, name } = payload.app_subscription;

        console.log(`[Webhook] Subscription update for ${shop}: ${status} (${name})`);

        // Map status to our internal states if needed, or store raw
        // Shopify statuses: ACTIVE, DECLINED, EXPIRED, FROZEN, CANCELLED, PENDING
        // "active" is typically what we want.

        // NOTE: 'status' field in webhook payload is uppercase e.g. 'ACTIVE'
        // but in DB we might store lowercase.

        await prisma.shop.update({
            where: { shopDomain: shop },
            data: {
                subscriptionStatus: status.toLowerCase(),
                planName: name,
                updatedAt: new Date()
            }
        });

        res.status(200).send('Webhook processed');

    } catch (error: any) {
        console.error('Subscription webhook processing failed:', error);
        res.status(500).send('Webhook processing failed');
    }
}
