import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { getShopifySession } from '@/lib/shopify';
import { shopify } from '@/lib/shopify';
import { verifySession } from '@/lib/password-auth';
import { checkRateLimit } from '@/lib/rate-limit';

interface ShopWithDetails {
  id: string;
  shopDomain: string;
  shopifyId: string;
  isActive: boolean;
  isPlus: boolean;
  ownerEmail?: string;
  ownerName?: string;
  shopName?: string;
  createdAt: Date;
  updatedAt: Date;
  locationSettingsCount: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // SECURITY: Rate limiting
  const clientId = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';
  const rateLimitResult = checkRateLimit(`admin:${clientId}`);
  
  if (!rateLimitResult.allowed) {
    res.setHeader('X-RateLimit-Limit', String(30));
    res.setHeader('X-RateLimit-Remaining', String(rateLimitResult.remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(rateLimitResult.resetTime / 1000)));
    return res.status(429).json({ 
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
    });
  }

  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', String(30));
  res.setHeader('X-RateLimit-Remaining', String(rateLimitResult.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(rateLimitResult.resetTime / 1000)));

  // SECURITY: Verify password-based session
  // Parse cookies from request headers
  const cookies = req.headers.cookie || '';
  const cookieMatch = cookies.match(/admin_session=([^;]+)/);
  const sessionToken = cookieMatch ? cookieMatch[1] : undefined;
  
  if (!verifySession(sessionToken)) {
    console.warn(`Unauthorized admin access attempt from ${clientId}`);
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  // SECURITY: Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  try {
    // First, check total count
    const totalCount = await prisma.shop.count();
    console.log(`[Admin API] Total shops in database: ${totalCount}`);

    // Get all shops from database
    const shops = await prisma.shop.findMany({
      select: {
        id: true,
        shopDomain: true,
        shopifyId: true,
        isActive: true,
        isPlus: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            locationSettings: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`[Admin API] Found ${shops.length} shops in database`);
    shops.forEach((shop, index) => {
      console.log(`[Admin API] Shop ${index + 1}: ${shop.shopDomain} (ID: ${shop.id}, Active: ${shop.isActive})`);
    });

    // Fetch additional shop details from Shopify API
    const shopsWithDetails: ShopWithDetails[] = await Promise.all(
      shops.map(async (shop) => {
        let ownerEmail: string | undefined;
        let ownerName: string | undefined;
        let shopName: string | undefined;

        try {
          const session = await getShopifySession(shop.shopDomain);
          if (session) {
            const client = new shopify.clients.Graphql({ session });
            
            // Fetch shop details including owner email
            const shopQuery = `
              query {
                shop {
                  name
                  email
                  contactEmail
                  myshopifyDomain
                }
              }
            `;

            const shopResponse = await client.query({
              data: { query: shopQuery },
            });

            const shopData = shopResponse.body as any;
            if (shopData.data?.shop) {
              shopName = shopData.data.shop.name;
              ownerEmail = shopData.data.shop.email || shopData.data.shop.contactEmail;
            }

            // Try to fetch shop owner name from shop settings
            try {
              const ownerQuery = `
                query {
                  shop {
                    owner {
                      firstName
                      lastName
                    }
                  }
                }
              `;

              const ownerResponse = await client.query({
                data: { query: ownerQuery },
              });

              const ownerData = ownerResponse.body as any;
              if (ownerData.data?.shop?.owner) {
                const firstName = ownerData.data.shop.owner.firstName || '';
                const lastName = ownerData.data.shop.owner.lastName || '';
                if (firstName || lastName) {
                  ownerName = `${firstName} ${lastName}`.trim();
                }
              }
            } catch (ownerError) {
              // Owner query may fail if we don't have the right scopes, that's OK
              console.log(`Could not fetch owner name for ${shop.shopDomain}`);
            }
          }
        } catch (error: any) {
          // If we can't fetch shop details, continue with what we have
          console.log(`Could not fetch shop details for ${shop.shopDomain}:`, error.message);
        }

        return {
          id: shop.id,
          shopDomain: shop.shopDomain,
          shopifyId: shop.shopifyId,
          isActive: shop.isActive,
          isPlus: shop.isPlus,
          ownerEmail,
          ownerName,
          shopName,
          createdAt: shop.createdAt,
          updatedAt: shop.updatedAt,
          locationSettingsCount: shop._count.locationSettings,
        };
      })
    );

    console.log(`[Admin API] Returning ${shopsWithDetails.length} shops with details`);
    res.json({ shops: shopsWithDetails });
  } catch (error: any) {
    console.error('[Admin API] Error fetching shops:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch shops' });
  }
}
