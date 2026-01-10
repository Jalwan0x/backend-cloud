import type { NextApiRequest, NextApiResponse } from 'next';
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

        if (!verifyWebhook(rawBody, hmac)) {
            return res.status(401).json({ error: 'Invalid webhook signature' });
        }

        const payload = JSON.parse(rawBody);
        console.log(`[Privacy] Customer Redact Request for ${shop}`, payload);

        // We do not store end-customer PII.
        // Acknowledge request.

        res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('Privacy webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
}
