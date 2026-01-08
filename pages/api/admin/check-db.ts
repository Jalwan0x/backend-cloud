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
    // Test database connection
    let dbConnected = false;
    let dbError = null;
    try {
      await prisma.$connect();
      dbConnected = true;
    } catch (error: any) {
      dbError = error.message;
      console.error('[Check DB] Database connection error:', error);
    }

    // Check if DATABASE_URL is set
    const hasDbUrl = !!process.env.DATABASE_URL;
    const dbUrlPreview = process.env.DATABASE_URL 
      ? `${process.env.DATABASE_URL.substring(0, 20)}...` 
      : 'NOT SET';

    // Try to count shops
    let shopCount = -1;
    let countError = null;
    try {
      shopCount = await prisma.shop.count();
    } catch (error: any) {
      countError = error.message;
      console.error('[Check DB] Count error:', error);
    }

    // Try to query shops
    let shops: Array<{
      id: string;
      shopDomain: string;
      shopifyId: string;
      isActive: boolean;
      createdAt: Date;
    }> = [];
    let queryError = null;
    try {
      shops = await prisma.shop.findMany({
        take: 5, // Just get first 5
        select: {
          id: true,
          shopDomain: true,
          shopifyId: true,
          isActive: true,
          createdAt: true,
        },
      });
    } catch (error: any) {
      queryError = error.message;
      console.error('[Check DB] Query error:', error);
    }

    res.json({
      database: {
        connected: dbConnected,
        hasUrl: hasDbUrl,
        urlPreview: dbUrlPreview,
        error: dbError,
      },
      shops: {
        count: shopCount,
        countError: countError,
        sample: shops,
        queryError: queryError,
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasPrisma: !!prisma,
      },
    });
  } catch (error: any) {
    console.error('[Check DB] Unexpected error:', error);
    res.status(500).json({ 
      error: error.message || 'Unexpected error',
      details: error.stack,
    });
  }
}
