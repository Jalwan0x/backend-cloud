import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { verifySession } from '@/lib/password-auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // SECURITY: Verify password-based session
  const cookies = req.headers.cookie || '';
  const cookieMatch = cookies.match(/admin_session=([^;]+)/);
  const sessionToken = cookieMatch ? cookieMatch[1] : undefined;
  
  if (!verifySession(sessionToken)) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  try {
    // Get total count
    const totalShops = await prisma.shop.count();
    const activeShops = await prisma.shop.count({ where: { isActive: true } });
    const inactiveShops = await prisma.shop.count({ where: { isActive: false } });

    // Get all shops with full details
    const allShops = await prisma.shop.findMany({
      select: {
        id: true,
        shopDomain: true,
        shopifyId: true,
        isActive: true,
        isPlus: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get location settings count per shop
    const shopsWithLocations = await prisma.shop.findMany({
      select: {
        id: true,
        shopDomain: true,
        _count: {
          select: {
            locationSettings: true,
          },
        },
      },
    });

    res.json({
      summary: {
        totalShops,
        activeShops,
        inactiveShops,
      },
      shops: allShops,
      locationCounts: shopsWithLocations.map(s => ({
        shopDomain: s.shopDomain,
        locationCount: s._count.locationSettings,
      })),
      message: 'Database debug information',
    });
  } catch (error: any) {
    console.error('[Debug DB] Error:', error);
    res.status(500).json({ 
      error: error.message || 'Database query failed',
      details: error.stack,
    });
  }
}
