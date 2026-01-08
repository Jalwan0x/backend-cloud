import type { NextApiRequest, NextApiResponse } from 'next';
import { getShopifySession } from '@/lib/shopify';
import { prisma } from '@/lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const shop = req.query.shop as string;
  if (!shop) {
    return res.status(400).json({ error: 'Shop parameter is required' });
  }

  const session = await getShopifySession(shop);
  if (!session) {
    return res.status(401).json({ error: 'Shop not authenticated' });
  }

  try {
    const shopRecord = await prisma.shop.findUnique({
      where: { shopDomain: shop },
      select: {
        id: true,
        shopDomain: true,
        isPlus: true,
        isActive: true,
        showBreakdown: true,
        sumRates: true,
        enableSplitShipping: true,
      },
    });

    if (!shopRecord) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    res.json({ shop: shopRecord });
  } catch (error: any) {
    console.error('Get shop error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch shop' });
  }
}
