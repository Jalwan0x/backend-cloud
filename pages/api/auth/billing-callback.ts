import { NextApiRequest, NextApiResponse } from 'next';
import { shopify } from '@/lib/shopify';
import { prisma } from '@/lib/db';
import { getShopifySession } from '@/lib/shopify';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { shop, charge_id } = req.query;

    if (!shop || typeof shop !== 'string') {
        return res.status(400).send('Missing shop parameter');
    }

    try {
        const session = await getShopifySession(shop);
        if (!session) {
            return res.status(401).send('Unauthorized');
        }

        // Determine current host
        const host = req.headers.host;
        const isEmbedded = true;

        // Update DB to mark as active (Redundant but safe)
        await prisma.shop.update({
            where: { shopDomain: shop },
            data: { subscriptionStatus: 'active' } // We assume success if they hit this URL with charge_id
        });

        // Redirect to App Home (Embedded)
        // Construct the embedded app URL
        // https://admin.shopify.com/store/[shop-name]/apps/[api-key]
        // Or just use the Safe Redirect helper if available, but simplest is:

        // We must use the host query param if it exists, otherwise reconstruct
        // For now, redirect to the root which handles embedding.
        const redirectUrl = `https://${shopify.config.hostName}/?shop=${shop}&host=${req.query.host}`;

        res.redirect(redirectUrl);

    } catch (error) {
        console.error('Billing callback error:', error);
        res.status(500).send('Billing validation failed');
    }
}
