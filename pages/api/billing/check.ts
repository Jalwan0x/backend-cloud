import { NextApiRequest, NextApiResponse } from 'next';
import { getShopifySession } from '@/lib/shopify';
import { ensureBilling } from '@/lib/billing';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const shop = req.query.shop as string;

    if (!shop) {
        return res.status(400).json({ error: 'Missing shop' });
    }

    const session = await getShopifySession(shop);
    if (!session) {
        return res.status(401).json({ error: 'Unauthorized', reauth: true });
    }

    try {
        const result = await ensureBilling(session, shop);

        // If not active, return the confirmation URL
        if (!result.hasActiveSubscription) {
            return res.status(402).json({
                error: 'Payment required',
                confirmationUrl: result.confirmationUrl
            });
        }

        res.status(200).json({ status: 'active' });

    } catch (error) {
        console.error('Billing API check error:', error);
        res.status(500).json({ error: 'Internal error' });
    }
}
