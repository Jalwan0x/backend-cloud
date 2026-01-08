import type { NextApiRequest, NextApiResponse } from 'next';
import { shopify } from '@/lib/shopify';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const shop = req.query.shop as string;
    console.log(`[OAuth Begin] Starting OAuth for shop: ${shop}`);
    console.log(`[OAuth Begin] Shopify API Key: ${process.env.SHOPIFY_API_KEY?.substring(0, 10)}...`);
    
    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    await shopify.auth.begin({
      shop,
      callbackPath: '/api/auth/callback',
      isOnline: false,
      rawRequest: req,
      rawResponse: res,
    });
    console.log(`[OAuth Begin] OAuth redirect initiated for ${shop}`);
  } catch (error: any) {
    console.error('[OAuth Begin] ERROR:', error);
    console.error('[OAuth Begin] Error message:', error.message);
    console.error('[OAuth Begin] Error stack:', error.stack);
    res.status(500).json({ error: error.message || 'Authentication failed' });
  }
}
