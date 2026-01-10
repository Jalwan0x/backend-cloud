import type { NextApiRequest, NextApiResponse } from 'next';
import { shopify } from '@/lib/shopify';
import { prisma } from '@/lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 1. EXTRACT SESSION TOKEN from Header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Bearer token' });
  }

  const sessionToken = authHeader.split(' ')[1];

  try {
    // 2. VERIFY TOKEN & GET SESSION
    // Decode the session token to get the payload (claims)
    const payload = await shopify.session.decodeSessionToken(sessionToken);

    if (!payload || !payload.dest) {
      return res.status(401).json({ error: 'Invalid session token' });
    }

    const shopDomain = payload.dest.replace('https://', '');


    // shopDomain is already extracted from payload.dest above
    // No redundant checks needed here since payload validation covers it


    // 3. FETCH SHOP DATA
    const shopRecord = await prisma.shop.findUnique({
      where: { shopDomain },
      select: {
        id: true,
        shopDomain: true,
        isPlus: true,
        isActive: true, // Only return active shops
        showBreakdown: true,
        sumRates: true,
        enableSplitShipping: true,
      },
    });

    if (!shopRecord || !shopRecord.isActive) {
      // 4. TRIGGER RE-AUTH IF NOT ACTIVE
      // If shop exists but isActive=false, or doesn't exist, we send 401
      // Frontend will then (and ONLY then) redirect to auth
      return res.status(401).json({ error: 'Shop not found or inactive', reauth: true });
    }

    res.json({ shop: shopRecord });

  } catch (error: any) {
    console.error('Get shop error (Token verification):', error);
    res.status(401).json({ error: 'Unauthorized', details: error.message });
  }
}
