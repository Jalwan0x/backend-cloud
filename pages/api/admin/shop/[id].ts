import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { verifyAuthCookie } from '@/lib/admin-auth';

// DELETE /api/admin/shop/[id]
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // 1. AUTH CHECK
    if (!verifyAuthCookie(req.cookies)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.query;

    if (req.method === 'DELETE') {
        if (!id || typeof id !== 'string') {
            return res.status(400).json({ error: 'Invalid ID' });
        }

        try {
            await prisma.shop.delete({
                where: { id },
            });
            console.log(`[Admin API] Deleted shop ${id}`);
            return res.status(200).json({ success: true });
        } catch (error: any) {
            console.error('[Admin API] Delete failed:', error);
            return res.status(500).json({ error: 'Failed to delete shop', details: error.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
