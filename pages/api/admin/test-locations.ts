import type { NextApiRequest, NextApiResponse } from 'next';
import { getShopifySession } from '@/lib/shopify';
import { shopify } from '@/lib/shopify';
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

  const shopDomain = req.query.shop as string;
  if (!shopDomain) {
    return res.status(400).json({ error: 'Shop parameter is required' });
  }

  // Normalize shop domain
  let normalizedShop = shopDomain.toLowerCase().trim();
  if (!normalizedShop.includes('.myshopify.com')) {
    normalizedShop = `${normalizedShop}.myshopify.com`;
  }

  try {
    // Check shop in database
    const shopRecord = await prisma.shop.findUnique({
      where: { shopDomain: normalizedShop },
      select: {
        id: true,
        shopDomain: true,
        isActive: true,
        scopes: true,
      },
    });

    if (!shopRecord) {
      return res.status(404).json({ error: `Shop not found in database: ${normalizedShop}` });
    }

    // Get session
    const session = await getShopifySession(normalizedShop);
    if (!session) {
      return res.status(401).json({ error: 'Session not found' });
    }

    // Test GraphQL query
    const client = new shopify.clients.Graphql({ session });
    
    // First, test a simple shop query
    const shopQuery = `
      query {
        shop {
          name
          id
        }
      }
    `;

    let shopTestResult = null;
    try {
      const shopResponse = await client.query({ data: { query: shopQuery } });
      shopTestResult = shopResponse.body;
    } catch (error: any) {
      shopTestResult = { error: error.message };
    }

    // Then test locations query
    const locationsQuery = `
      query {
        locations(first: 250) {
          edges {
            node {
              id
              name
              active
            }
          }
        }
      }
    `;

    let locationsResult = null;
    try {
      const locationsResponse = await client.query({ data: { query: locationsQuery } });
      locationsResult = locationsResponse.body;
    } catch (error: any) {
      locationsResult = { error: error.message, stack: error.stack };
    }

    res.json({
      shop: {
        inDatabase: shopRecord,
        sessionExists: !!session,
        sessionShop: session.shop,
      },
      shopQuery: shopTestResult,
      locationsQuery: locationsResult,
      message: 'Test results',
    });
  } catch (error: any) {
    console.error('[Test Locations] Error:', error);
    res.status(500).json({ 
      error: error.message || 'Test failed',
      details: error.stack,
    });
  }
}
