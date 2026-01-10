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

  const shopRecord = await prisma.shop.findUnique({
    where: { shopDomain: shop },
  });

  if (!shopRecord) {
    return res.status(404).json({ error: 'Shop not found' });
  }

  // CRITICAL: Enforce App Uninstall Policy
  if (!shopRecord.isActive) {
    console.warn(`[Shop Settings] Blocked request for uninstalled shop: ${shop}`);
    return res.status(403).json({ error: 'App is uninstalled. Please reinstall.', uninstalled: true });
  }

  if (req.method === 'GET') {
    try {
      res.json({
        showBreakdown: shopRecord.showBreakdown,
        sumRates: shopRecord.sumRates,
        enableSplitShipping: shopRecord.enableSplitShipping,
        isPlus: shopRecord.isPlus,
      });
    } catch (error: any) {
      console.error('Get shop settings error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch settings' });
    }
  } else if (req.method === 'PUT') {
    try {
      const { showBreakdown, sumRates, enableSplitShipping } = req.body;

      const updated = await prisma.shop.update({
        where: { shopDomain: shop },
        data: {
          ...(showBreakdown !== undefined && { showBreakdown }),
          ...(sumRates !== undefined && { sumRates }),
          ...(enableSplitShipping !== undefined && { enableSplitShipping }),
        },
      });

      res.json({
        showBreakdown: updated.showBreakdown,
        sumRates: updated.sumRates,
        enableSplitShipping: updated.enableSplitShipping,
      });
    } catch (error: any) {
      console.error('Update shop settings error:', error);
      res.status(500).json({ error: error.message || 'Failed to update settings' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
