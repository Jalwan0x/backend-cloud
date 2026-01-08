import type { NextApiRequest, NextApiResponse } from 'next';
import { getShopifySession } from '@/lib/shopify';
import { prisma } from '@/lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const shop = req.query.shop as string;
    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    // Check if shop is active
    const shopRecord = await prisma.shop.findUnique({
      where: { shopDomain: shop },
      select: { id: true, isActive: true },
    });

    if (!shopRecord || !shopRecord.isActive) {
      return res.status(401).json({ error: 'Shop not found or app uninstalled' });
    }

    const session = await getShopifySession(shop);
    if (!session) {
      return res.status(401).json({ error: 'Shop not authenticated' });
    }

  if (req.method === 'GET') {
    try {
      const settings = await prisma.locationSetting.findMany({
        where: { shopId: shopRecord.id },
        orderBy: { priority: 'asc' },
      });

      res.json({ settings });
    } catch (error: any) {
      console.error('Get location settings error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch settings' });
    }
  } else if (req.method === 'POST') {
    try {
      const { shopifyLocationId, locationName, shippingCost, etaMin, etaMax, priority } = req.body;

      if (!shopifyLocationId || !locationName) {
        return res.status(400).json({ error: 'shopifyLocationId and locationName are required' });
      }

      const setting = await prisma.locationSetting.upsert({
        where: {
          shopId_shopifyLocationId: {
            shopId: shopRecord.id,
            shopifyLocationId,
          },
        },
        update: {
          locationName,
          shippingCost: parseFloat(shippingCost) || 0,
          etaMin: parseInt(etaMin) || 1,
          etaMax: parseInt(etaMax) || 2,
          priority: parseInt(priority) || 0,
          isActive: true,
        },
        create: {
          shopId: shopRecord.id,
          shopifyLocationId,
          locationName,
          shippingCost: parseFloat(shippingCost) || 0,
          etaMin: parseInt(etaMin) || 1,
          etaMax: parseInt(etaMax) || 2,
          priority: parseInt(priority) || 0,
          isActive: true,
        },
      });

      res.json({ setting });
    } catch (error: any) {
      console.error('Create/update location setting error:', error);
      res.status(500).json({ error: error.message || 'Failed to save setting' });
    }
  } else if (req.method === 'PUT') {
    try {
      const { id, ...updateData } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'id is required' });
      }

      const setting = await prisma.locationSetting.update({
        where: { id },
        data: {
          ...(updateData.shippingCost !== undefined && { shippingCost: parseFloat(updateData.shippingCost) }),
          ...(updateData.etaMin !== undefined && { etaMin: parseInt(updateData.etaMin) }),
          ...(updateData.etaMax !== undefined && { etaMax: parseInt(updateData.etaMax) }),
          ...(updateData.priority !== undefined && { priority: parseInt(updateData.priority) }),
          ...(updateData.isActive !== undefined && { isActive: updateData.isActive }),
        },
      });

      res.json({ setting });
    } catch (error: any) {
      console.error('Update location setting error:', error);
      res.status(500).json({ error: error.message || 'Failed to update setting' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'id is required' });
      }

      await prisma.locationSetting.delete({
        where: { id },
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('Delete location setting error:', error);
      res.status(500).json({ error: error.message || 'Failed to delete setting' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
  } catch (error: any) {
    console.error('Location settings API error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
