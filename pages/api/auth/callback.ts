import type { NextApiRequest, NextApiResponse } from 'next';
import { shopify } from '@/lib/shopify';
import { prisma } from '@/lib/db';
import { registerWebhooks } from '@/lib/webhook-registration';
import { registerCarrierService } from '@/lib/carrier-service-registration';
import { fetchAndSaveShopDetails } from '@/lib/shopify-data';
import { encrypt } from '@/lib/encryption';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    console.log("🔥 MANUAL OAUTH CALLBACK HIT");

    // 1. Extract Query Params
    const { shop, code, hmac } = req.query as { [key: string]: string };

    if (!shop || !code || !hmac) {
      console.error('[Manual OAuth] Missing required parameters');
      return res.status(400).send('Missing required parameters');
    }

    // 2. Validate HMAC (Security)
    const isValidHmac = await shopify.utils.validateHmac(req.query as any);
    if (!isValidHmac) {
      console.error('[Manual OAuth] HMAC Validation Failed');
      return res.status(400).send('HMAC validation failed');
    }

    const normalizedShop = shop.toLowerCase();
    const cleanShop = normalizedShop.replace(".myshopify.com", "");
    const redirectUrl = `https://admin.shopify.com/store/${cleanShop}/apps/${process.env.SHOPIFY_API_KEY}`;

    // 3. ATTEMPT TOKEN EXCHANGE (Always try to get a fresh token first)
    // We only check for existing shop if exchange fails (e.g. Code Already Used)

    console.log('[Manual OAuth] HMAC Verified. Exchanging code for token...');

    const params = new URLSearchParams();
    params.append('client_id', process.env.SHOPIFY_API_KEY!);
    params.append('client_secret', process.env.SHOPIFY_API_SECRET!);
    params.append('code', code);

    let tokenData;

    try {
      const accessTokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });

      if (!accessTokenResponse.ok) {
        const errorText = await accessTokenResponse.text();
        console.warn('[Manual OAuth] Token exchange failed:', errorText);

        // 4. FALLBACK: IDEMPOTENCY CHECK
        // If token exchange failed (probably "authorization code already used"), 
        // check if we have a valid session anyway.
        const existingShop = await prisma.shop.findUnique({
          where: { shopDomain: normalizedShop },
        });

        if (existingShop && existingShop.accessToken && existingShop.isActive) {
          console.log(`[Manual OAuth] Exchange failed but Shop ${normalizedShop} is active. Treating as success (Idempotent).`);
          return res.redirect(redirectUrl);
        }

        // Real failure
        return res.status(500).json({ error: 'Failed to exchange token', details: errorText });
      }

      tokenData = await accessTokenResponse.json();

    } catch (networkError: any) {
      console.error('[Manual OAuth] Network error during exchange:', networkError);
      return res.status(500).json({ error: 'Network error during token exchange' });
    }

    const { access_token, scope } = tokenData;

    console.log('[Manual OAuth] Token Received');
    console.log(`[Manual OAuth] Scopes Received: ${scope}`);

    // Encrypt token before storage
    const encryptedAccessToken = encrypt(access_token);
    console.log(`[Manual OAuth] Encrypted Token Length: ${encryptedAccessToken.length}, Preview: ${encryptedAccessToken.substring(0, 20)}...`);

    // 5. UPSERT SHOP
    await prisma.shop.upsert({
      where: { shopDomain: normalizedShop },
      update: {
        accessToken: encryptedAccessToken,
        scopes: scope || '',
        isActive: true,
        needsReauth: false,
        updatedAt: new Date(),
      },
      create: {
        shopDomain: normalizedShop,
        shopifyId: normalizedShop.replace('.myshopify.com', ''),
        accessToken: encryptedAccessToken,
        scopes: scope || '',
        isActive: true,
      },
    });

    console.log("✅ SHOP SAVED", normalizedShop);

    // 6. Post-Process (Webhooks, etc.)
    // Run in background to not block redirect
    registerWebhooks(normalizedShop).catch(e => console.error('Webhook registration failed:', e));
    registerCarrierService(normalizedShop).catch(e => console.error('CarrierService registration failed:', e));

    // Fetch Owner Details (Synchronous wait to ensure Vercel doesn't kill process)
    // Critical for Admin Dashboard to show email immediately.
    try {
      await fetchAndSaveShopDetails(normalizedShop, access_token);
    } catch (e) {
      console.error('Owner details fetch failed:', e);
    }

    console.log("OAUTH CALLBACK SUCCESS -> REDIRECTING");
    return res.redirect(redirectUrl);

  } catch (error: any) {
    console.error('Manual OAuth callback error:', error);
    res.status(500).json({ error: error.message || 'Authentication failed' });
  }
}
