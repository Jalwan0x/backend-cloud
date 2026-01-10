import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { verifyAuthCookie } from '@/lib/admin-auth';
import { ensureDatabaseReady } from '@/lib/db-init';

// --- SHOP DATA API (PROTECTED) ---

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. AUTH CHECK
  if (!verifyAuthCookie(req.cookies)) {
    console.warn('[Admin API] Unauthorized access attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 2. DB INIT & QUERY
  try {
    // Ensure DB is ready before querying
    await ensureDatabaseReady();

    // Check connection/env first via a simple count
    // This catches "DATABASE_URL missing" errors gracefully
    const totalCount = await prisma.shop.count();

    const shops = await prisma.shop.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        shopDomain: true,
        isActive: true,
        isPlus: true,
        shopName: true,
        ownerName: true,
        ownerEmail: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { locationSettings: true } }
      }
    });

    console.log(`[Admin API] Fetched ${shops.length} shops`);
    return res.status(200).json({ shops, totalCount });

  } catch (error: any) {
    console.error('[Admin API] Database Error:', error);

    // CRITICAL: Return 500, NOT 401. 
    // This ensures frontend displays an error message instead of redirecting to login.
    return res.status(500).json({
      error: 'Database connection failed',
      details: error.message
    });
  }
}
