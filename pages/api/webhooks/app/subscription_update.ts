import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { verifyWebhook } from '@/lib/webhook-verification';
import getRawBody from 'raw-body';

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
            console.warn(`[Webhook] Invalid signature for topic app_subscriptions/update shop ${shop}`);
            return res.status(401).json({ error: 'Invalid webhook signature' });
        }

        const payload = JSON.parse(rawBody);
        const { status, name } = payload.app_subscription;

        console.log(`[Webhook] Subscription update for ${shop}: ${status} (${name})`);

        // Update DB
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
        if (!res.headersSent) {
            res.status(500).send('Webhook processing failed');
        }
    }
}
