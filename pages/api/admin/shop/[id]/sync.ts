import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { verifyAuthCookie } from '@/lib/admin-auth';
import { fetchAndSaveShopDetails } from '@/lib/shopify-data';

// POST /api/admin/shop/[id]/sync
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // 1. AUTH CHECK
    if (!verifyAuthCookie(req.cookies)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.query;

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Invalid ID' });
    }

    try {
        // 2. Fetch Shop to get Domain
        const shop = await prisma.shop.findUnique({
            where: { id },
            select: { shopDomain: true, accessToken: true } // We don't decrypt here, helper does it if we don't pass raw
        });

        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        // 3. Trigger Fetch
        // We let the helper handle decryption by NOT passing the second arg, 
        // OR we could decrypt here. The helper `fetchAndSaveShopDetails` handles logic:
        // "if (!token) { db fetch ... decrypt }"
        // So we just pass the domain.

        console.log(`[Admin Sync] Syncing data for ${shop.shopDomain}...`);
        const success = await fetchAndSaveShopDetails(shop.shopDomain);

        if (success) {
            // Fetch fresh data to return
            const updatedShop = await prisma.shop.findUnique({
                where: { id },
                select: { ownerEmail: true, ownerName: true, shopName: true }
            });
            return res.status(200).json({ success: true, shop: updatedShop });
        } else {
            return res.status(500).json({ error: 'Sync failed (Check server logs or token status)' });
        }

    } catch (error: any) {
        console.error('[Admin Sync] Error:', error);
        return res.status(500).json({ error: error.message || 'Internal error' });
    }
}
