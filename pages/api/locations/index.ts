import type { NextApiRequest, NextApiResponse } from 'next';
import { LATEST_API_VERSION } from '@shopify/shopify-api';
import { getShopifySession } from '@/lib/shopify';
import { shopify } from '@/lib/shopify';
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

    // Normalize shop domain
    let normalizedShop = shop.toLowerCase().trim();
    if (!normalizedShop.includes('.myshopify.com')) {
      normalizedShop = `${normalizedShop}.myshopify.com`;
    }



    // Check if shop is active
    const shopRecord = await prisma.shop.findUnique({
      where: { shopDomain: normalizedShop },
      select: { isActive: true, id: true, shopDomain: true },
    });



    if (!shopRecord || !shopRecord.isActive) {
      console.error(`[Locations API] Shop not found or inactive: ${normalizedShop}`);
      return res.status(403).json({ error: 'App is uninstalled. Please reinstall.', uninstalled: true });
    }


    const session = await getShopifySession(normalizedShop);
    if (!session) {
      console.error(`[Locations API] Session not found for: ${normalizedShop}`);
      return res.status(401).json({ error: 'Shop not authenticated', reauth: true });
    }


    // Force Re-Auth if scopes are missing (Healing Logic)
    if (!session.scope?.includes('read_locations')) {
      console.warn(`[Locations API] Session exists but missing 'read_locations'. Force Re-Auth.`);
      return res.status(401).json({ error: 'Missing permission: read_locations', reauth: true });
    }

    if (req.method === 'GET') {
      try {


        // Use REST API (Proven working by Diagnostic)
        // GraphQL was returning empty edges for some reason despite permissions.
        const response = await fetch(`https://${normalizedShop}/admin/api/${LATEST_API_VERSION}/locations.json`, {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': session.accessToken || '',
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error(`[Locations API] REST Request Failed: ${response.status} ${response.statusText}`);
          return res.status(response.status).json({ error: 'Failed to fetch locations from Shopify' });
        }

        const data = await response.json() as any;


        const locations = (data.locations || []).map((loc: any) => ({
          id: loc.id.toString(),
          name: loc.name,
          address: {
            address1: loc.address1,
            city: loc.city,
            province: loc.province,
            country: loc.country,
            zip: loc.zip
          },
          active: loc.active
        }));

        // LAZY SYNC: Upsert these into DB to ensure Admin Dashboard & Settings work
        try {
          await Promise.all(locations.map(async (loc: any) => {
            return prisma.locationSetting.upsert({
              where: {
                shopId_shopifyLocationId: {
                  shopId: shopRecord.id,
                  shopifyLocationId: loc.id
                }
              },
              update: {
                locationName: loc.name,
                isActive: loc.active,
                updatedAt: new Date(),
              },
              create: {
                shopId: shopRecord.id,
                shopifyLocationId: loc.id,
                locationName: loc.name,
                isActive: loc.active,
                priority: 0,
                etaMin: 1,
                etaMax: 2,
                shippingCost: 0
              }
            });
          }));

        } catch (syncErr) {
          console.error('[Locations API] Lazy sync failed (non-critical):', syncErr);
        }

        res.json({ locations, debug: { scopes: session.scope } });

      } catch (error: any) {
        console.error('Get locations error:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch locations' });
      }
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Locations API error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
