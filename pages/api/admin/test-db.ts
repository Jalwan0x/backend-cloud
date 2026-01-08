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
    // Get all shops - no filtering
    const allShops = await prisma.shop.findMany({
      select: {
        id: true,
        shopDomain: true,
        shopifyId: true,
        isActive: true,
        isPlus: true,
        createdAt: true,
      },
    });

    // Get shop count
    const shopCount = await prisma.shop.count();

    res.json({
      totalShops: shopCount,
      shops: allShops,
      message: 'Database connection successful',
    });
  } catch (error: any) {
    console.error('[Test DB] Error:', error);
    res.status(500).json({ 
      error: error.message || 'Database query failed',
      details: error.stack,
    });
  }
}
