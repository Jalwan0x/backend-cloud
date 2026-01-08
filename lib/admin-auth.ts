import { NextApiRequest } from 'next';
import { getShopifySession } from './shopify';
import { prisma } from './db';

/**
 * Admin authentication middleware
 * Only allows access from authorized admin shops
 */
export async function verifyAdminAccess(req: NextApiRequest): Promise<{ authorized: boolean; shopDomain?: string; error?: string }> {
  try {
    // Get shop from query parameter (from Shopify App Bridge)
    const shop = req.query.shop as string;
    
    if (!shop) {
      return { authorized: false, error: 'Shop parameter is required' };
    }

    // Check if shop is in the admin list (from environment variable)
    const adminShops = (process.env.ADMIN_SHOP_DOMAINS || '').split(',').map(s => s.trim()).filter(Boolean);
    
    if (adminShops.length === 0) {
      // If no admin shops configured, deny access
      console.warn('No admin shops configured in ADMIN_SHOP_DOMAINS');
      return { authorized: false, error: 'Admin access not configured' };
    }

    // Normalize shop domain (remove protocol, ensure .myshopify.com)
    const normalizedShop = shop.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const shopDomain = normalizedShop.includes('.myshopify.com') 
      ? normalizedShop 
      : `${normalizedShop}.myshopify.com`;

    // Check if shop is in admin list
    if (!adminShops.some(adminShop => {
      const normalizedAdmin = adminShop.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
      const adminDomain = normalizedAdmin.includes('.myshopify.com')
        ? normalizedAdmin
        : `${normalizedAdmin}.myshopify.com`;
      return adminDomain === shopDomain;
    })) {
      console.warn(`Unauthorized admin access attempt from ${shopDomain}`);
      return { authorized: false, error: 'Unauthorized access' };
    }

    // Verify shop session exists and is active
    const session = await getShopifySession(shopDomain);
    if (!session) {
      return { authorized: false, error: 'Shop session not found' };
    }

    // Verify shop is active in database
    const shopRecord = await prisma.shop.findUnique({
      where: { shopDomain },
      select: { isActive: true },
    });

    if (!shopRecord || !shopRecord.isActive) {
      return { authorized: false, error: 'Shop is not active' };
    }

    return { authorized: true, shopDomain };
  } catch (error: any) {
    console.error('Admin authentication error:', error);
    return { authorized: false, error: 'Authentication failed' };
  }
}

/**
 * Check if a shop domain is an admin shop
 */
export function isAdminShop(shopDomain: string): boolean {
  const adminShops = (process.env.ADMIN_SHOP_DOMAINS || '').split(',').map(s => s.trim()).filter(Boolean);
  
  if (adminShops.length === 0) {
    return false;
  }

  const normalizedShop = shopDomain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const normalizedDomain = normalizedShop.includes('.myshopify.com')
    ? normalizedShop
    : `${normalizedShop}.myshopify.com`;

  return adminShops.some(adminShop => {
    const normalizedAdmin = adminShop.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const adminDomain = normalizedAdmin.includes('.myshopify.com')
      ? normalizedAdmin
      : `${normalizedAdmin}.myshopify.com`;
    return adminDomain === normalizedDomain;
  });
}
