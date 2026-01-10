import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { verifyAuthCookie } from '@/lib/admin-auth';

// --- ADMIN CSV EXPORT API ---

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 1. AUTH CHECK
    if (!verifyAuthCookie(req.cookies)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // 2. QUERY ACTIVE SHOPS
        const shops = await prisma.shop.findMany({
            where: { isActive: true },
            select: {
                shopName: true,
                shopDomain: true,
                ownerName: true,
                ownerEmail: true,
                createdAt: true,
                isPlus: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        // 3. GENERATE CSV
        const headers = ['Shop Name', 'Shop Domain', 'Owner Name', 'Owner Email', 'Plan', 'Installed Date'];
        const rows = shops.map(shop => [
            shop.shopName || '',
            shop.shopDomain,
            shop.ownerName || '',
            shop.ownerEmail || '',
            shop.isPlus ? 'Plus' : 'Standard',
            new Date(shop.createdAt).toISOString().split('T')[0],
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        // 4. SET HEADERS & DOWNLOAD
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=cloudship_emails.csv');
        res.status(200).send(csvContent);

    } catch (error: any) {
        console.error('[Admin Export] Error:', error);
        res.status(500).json({ error: 'Export failed' });
    }
}
