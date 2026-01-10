import type { NextApiRequest, NextApiResponse } from 'next';
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

    console.log(`[Locations API] Looking for shop: ${normalizedShop}`);

    // Check if shop is active
    const shopRecord = await prisma.shop.findUnique({
      where: { shopDomain: normalizedShop },
      select: { isActive: true, id: true, shopDomain: true },
    });

    console.log(`[Locations API] Shop record found:`, shopRecord ? { id: shopRecord.id, domain: shopRecord.shopDomain, active: shopRecord.isActive } : 'NOT FOUND');

    if (!shopRecord || !shopRecord.isActive) {
      console.error(`[Locations API] Shop not found or inactive: ${normalizedShop}`);
      return res.status(401).json({ error: 'Shop not found or app uninstalled', reauth: true });
    }

    console.log(`[Locations API] Getting session for: ${normalizedShop}`);
    const session = await getShopifySession(normalizedShop);
    if (!session) {
      console.error(`[Locations API] Session not found for: ${normalizedShop}`);
      return res.status(401).json({ error: 'Shop not authenticated', reauth: true });
    }
    console.log(`[Locations API] Session retrieved successfully for: ${normalizedShop}`);

    // Force Re-Auth if scopes are missing (Healing Logic)
    if (!session.scope?.includes('read_locations')) {
      console.warn(`[Locations API] Session exists but missing 'read_locations'. Force Re-Auth.`);
      return res.status(401).json({ error: 'Missing permission: read_locations', reauth: true });
    }

    if (req.method === 'GET') {
      try {
        const client = new shopify.clients.Graphql({ session });
        // Support unlimited warehouses - Shopify allows up to 250 locations per query
        const query = `
        query {
          locations(first: 250) {
            edges {
              node {
                id
                name
                address {
                  address1
                  city
                  province
                  country
                  zip
                }
                active
              }
            }
          }
        }
      `;

        console.log(`[Locations API] Executing GraphQL query for ${normalizedShop}`);
        console.log(`[Locations API] Session shop: ${session.shop}, Session ID: ${session.id}`);
        console.log(`[Locations API] Access token exists: ${!!session.accessToken}`);

        const response = await client.query({
          data: { query },
        });

        const data = response.body as any;
        console.log(`[Locations API] GraphQL response received for ${normalizedShop}`);
        console.log(`[Locations API] Full response:`, JSON.stringify(data, null, 2));

        // Check for GraphQL errors
        if (data.errors) {
          console.error(`[Locations API] GraphQL errors for ${normalizedShop}:`, JSON.stringify(data.errors, null, 2));
          return res.status(500).json({ error: 'GraphQL query failed', details: data.errors });
        }

        // Log response structure for debugging
        if (!data.data) {
          console.warn(`[Locations API] No data in response for ${normalizedShop}:`, JSON.stringify(data, null, 2));
          return res.json({ locations: [] });
        }

        if (!data.data?.locations) {
          console.error(`[Locations API] 'locations' field missing from response. Likely missing 'read_locations' scope. Response:`, JSON.stringify(data, null, 2));
          return res.status(403).json({ error: 'Missing permissions: read_locations', details: 'The app lacks the required scope to fetch locations.' });
        }

        const edges = data.data.locations.edges || [];
        console.log(`[Locations API] Found ${edges.length} location edges for ${normalizedShop}`);

        if (edges.length === 0) {
          console.warn(`[Locations API] No location edges found for ${normalizedShop}. Response:`, JSON.stringify(data.data.locations, null, 2));
        }

        const locations = edges.map((edge: any) => {
          if (!edge?.node) {
            console.warn(`[Locations API] Invalid edge structure:`, edge);
            return null;
          }
          const locationId = edge.node.id?.replace('gid://shopify/Location/', '') || edge.node.id;
          return {
            id: locationId,
            name: edge.node.name || 'Unnamed Location',
            address: edge.node.address || {},
            active: edge.node.active !== false, // Default to true if not specified
          };
        }).filter(Boolean); // Remove any null entries

        console.log(`[Locations API] Parsed ${locations.length} locations for ${normalizedShop}:`, locations.map((l: { id: string; name: string }) => l.name));

        // LAZY SYNC: Upsert these into DB to ensure Admin Dashboard & Settings work
        // This fixes the "0 locations" bug if the install hook missed them.
        try {
          // Use Promise.all for speed? Or sequential to avoid connection spam? 
          // 250 locations max, sequential might be slow. Promise.all with some concurrency is better, 
          // but strictly, Promise.all is fine for reasonable counts.
          // Note: shopRecord.id is available from earlier.
          await Promise.all(locations.map(async (loc: any) => {
            return prisma.locationSetting.upsert({
              where: {
                shopId_shopifyLocationId: {
                  shopId: shopRecord.id, // shopRecord from line 25
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
          console.log(`[Locations API] Automatically synced ${locations.length} locations to DB.`);
        } catch (syncErr) {
          console.error('[Locations API] Lazy sync failed (non-critical):', syncErr);
          // Don't fail the request, just log it. The user still gets their locations list.
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
