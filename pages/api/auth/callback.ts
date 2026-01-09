import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { registerWebhooks } from '@/lib/webhook-registration';
import { registerCarrierService } from '@/lib/carrier-service-registration';
import crypto from 'crypto';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    console.log("🔥 MANUAL OAUTH CALLBACK HIT");

    // 1. Extract Query Params
    const { shop, code, hmac, state } = req.query as { [key: string]: string };

    if (!shop || !code || !hmac) {
      console.error('[Manual OAuth] Missing required parameters');
      return res.status(400).send('Missing required parameters');
    }

    // 2. Validate HMAC (Security)
    // We do this manually to bypass shopify-api-js strict state/cookie checks
    const map = Object.assign({}, req.query);
    delete map['hmac'];
    const message = Object.keys(map)
      .sort((value1, value2) => value1.localeCompare(value2))
      .map((key) => {
        return `${key}=${map[key]}`;
      })
      .join('&');

    const generatedHmac = crypto
      .createHmac('sha256', process.env.SHOPIFY_API_SECRET!)
      .update(message)
      .digest('hex');

    if (generatedHmac !== hmac) {
      console.error('[Manual OAuth] HMAC Validation Failed');
      return res.status(400).send('HMAC validation failed');
    }

    console.log('[Manual OAuth] HMAC Verified. Exchanging code for token...');

    // 3. Exchange Code for Access Token
    const accessTokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code,
      }),
    });

    if (!accessTokenResponse.ok) {
      const errorText = await accessTokenResponse.text();
      console.error('[Manual OAuth] Token exchange failed:', errorText);
      return res.status(500).json({ error: 'Failed to exchange token', details: errorText });
    }

    const tokenData = await accessTokenResponse.json();
    const { access_token, scope } = tokenData;

    console.log('[Manual OAuth] Token Received');

    // 4. MANDATORY FIX: UPSERT SHOP IMMEDIATELY
    const normalizedShop = shop.toLowerCase();

    await prisma.shop.upsert({
      where: { shopDomain: normalizedShop },
      update: {
        accessToken: access_token,
        updatedAt: new Date(),
      },
      create: {
        shopDomain: normalizedShop,
        shopifyId: normalizedShop.replace('.myshopify.com', ''),
        accessToken: access_token,
        scopes: scope || '',
        isActive: true,
      },
    });

    console.log("✅ SHOP SAVED", normalizedShop);
    const count = await prisma.shop.count();
    console.log("🧪 SHOP COUNT", count);

    // 5. Post-Process (Webhooks, etc.)
    registerWebhooks(normalizedShop).catch(e => console.error('Webhook registration failed:', e));
    registerCarrierService(normalizedShop).catch(e => console.error('CarrierService registration failed:', e));

    // 6. Redirect to App
    const redirectUrl = `https://${normalizedShop}/admin/apps/${process.env.SHOPIFY_API_KEY}`;
    res.redirect(redirectUrl);

  } catch (error: any) {
    console.error('Manual OAuth callback error:', error);
    res.status(500).json({ error: error.message || 'Authentication failed' });
  }
}
