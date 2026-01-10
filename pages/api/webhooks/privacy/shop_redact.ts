import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyWebhook } from '@/lib/webhook-verification';
import getRawBody from 'raw-body';
import { prisma } from '@/lib/db';

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
        const shopDomain = req.headers['x-shopify-shop-domain'] as string;

        if (!verifyWebhook(rawBody, hmac)) {
            return res.status(401).json({ error: 'Invalid webhook signature' });
        }

        const payload = JSON.parse(rawBody);
        console.log(`[Privacy] Shop Redact Request for ${shopDomain}`, payload);

        // 48 hours after uninstall, Shopify requests data deletion.
        // We should scrub PII (ownerName, ownerEmail) from the Shop record.
        // We can keep the record itself for accounting if anonymous, or delete it entirely.
        // Deleting entirely is cleaner for "Redact".

        // Check if shop exists
        const shop = await prisma.shop.findUnique({ where: { shopDomain } });
        if (shop) {
            // Option 1: Delete everything
            // await prisma.shop.delete({ where: { shopDomain } });

            // Option 2: Anonymize (Safer if we want to track install history stats)
            await prisma.shop.update({
                where: { shopDomain },
                data: {
                    ownerName: 'Redacted',
                    ownerEmail: 'redacted@example.com',
                    shopName: 'Redacted',
                    scopes: '',
                    accessToken: 'REDACTED',
                    isActive: false
                }
            });

            // Delete associated personal data if any
            await prisma.locationSetting.deleteMany({ where: { shopId: shop.id } });
            await prisma.webhook.deleteMany({ where: { shopId: shop.id } });
        }

        res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('Privacy webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
}
