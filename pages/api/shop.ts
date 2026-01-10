import type { NextApiRequest, NextApiResponse } from 'next';
import { shopify } from '@/lib/shopify';
import { prisma } from '@/lib/db';
import { fetchAndSaveShopDetails } from '@/lib/shopify-data';

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
    const payload = await shopify.session.decodeSessionToken(sessionToken);

    if (!payload || !payload.dest) {
      return res.status(401).json({ error: 'Invalid session token' });
    }

    // Extract shop domain from JWT destination claim (https://store.myshopify.com)
    const shopDomain = payload.dest.replace('https://', '');

    // 3. FETCH SHOP DATA
    const shopRecord = await prisma.shop.findUnique({
      where: { shopDomain },
      select: {
        id: true,
        shopDomain: true,
        isPlus: true,
        isActive: true,
        showBreakdown: true,
        sumRates: true,
        enableSplitShipping: true,
        ownerEmail: true,
        ownerFetchedAt: true,
      },
    });

    // 4. CHECK IF ACTIVE
    if (!shopRecord || !shopRecord.isActive) {
      return res.status(401).json({ error: 'Shop not found or inactive', reauth: true });
    }

    // 5. LAZY FETCH OWNER DETAILS (Backfill)
    if (!shopRecord.ownerEmail) {
      const lastFetch = shopRecord.ownerFetchedAt ? new Date(shopRecord.ownerFetchedAt).getTime() : 0;
      const now = Date.now();
      const hoursSinceFetch = (now - lastFetch) / (1000 * 60 * 60);

      // Fetch if never fetched OR old fetch > 24h
      if (!shopRecord.ownerFetchedAt || hoursSinceFetch > 24) {
        console.log(`[Lazy Fetch] Triggering owner details fetch for ${shopDomain}`);
        // Run in background (do not await) with error catching
        fetchAndSaveShopDetails(shopDomain).catch(err => console.error('[Lazy Fetch] Failed:', err));
      }
    }

    res.json({ shop: shopRecord });

  } catch (error: any) {
    console.error('Get shop error (Token verification):', error);

    // DEBUG: Diagnose invalid signature
    if (sessionToken && sessionToken.includes('.')) {
      try {
        const [header, payload] = sessionToken.split('.');
        const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
        console.log('---------------------------------------------------');
        console.log('🔍 JWT DEBUG REPORT 🔍');
        console.log('Token ISS (Issuer):', decoded.iss);
        console.log('Token AUD (Audience):', decoded.aud);
        console.log('Expected AUD (API Key):', process.env.SHOPIFY_API_KEY);
        console.log('Did AUD match?', decoded.aud === process.env.SHOPIFY_API_KEY ? 'YES' : 'NO ❌');
        console.log('---------------------------------------------------');
      } catch (e) {
        console.error('Failed to parse JWT for debugging:', e);
      }
    }

    res.status(401).json({ error: 'Unauthorized', details: error.message, reauth: true });
  }
}
