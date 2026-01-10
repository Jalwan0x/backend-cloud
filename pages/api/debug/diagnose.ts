import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { LATEST_API_VERSION } from '@shopify/shopify-api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const shop = req.query.shop as string;
    if (!shop) return res.status(400).json({ error: 'Missing shop param' });

    let normalizedShop = shop.toLowerCase().trim();
    if (!normalizedShop.includes('.myshopify.com')) {
        normalizedShop = `${normalizedShop}.myshopify.com`;
    }

    const response: any = {
        step: 'Diagnostic',
        input_shop: shop,
        normalized_shop: normalizedShop,
        timestamp: new Date().toISOString(),
    };

    try {
        // 1. Check DB
        const dbShop = await prisma.shop.findUnique({ where: { shopDomain: normalizedShop } });

        if (!dbShop) {
            // Fallback: List available shops to detect mismatch
            const allShops = await prisma.shop.findMany({ select: { shopDomain: true }, take: 10 });
            return res.status(404).json({
                ...response,
                error: 'Shop not found in DB',
                available_shops_in_db: allShops.map(s => s.shopDomain)
            });
        }
        response.db_record = {
            id: dbShop.id,
            isActive: dbShop.isActive,
            scopes: dbShop.scopes,
            needsReauth: dbShop.needsReauth,
        };

        // 2. Decrypt Token
        let token = '';
        try {
            token = decrypt(dbShop.accessToken);
            response.token = {
                present: true,
                length: token.length,
                preview: token.substring(0, 5) + '...',
            };
        } catch (e: any) {
            response.token = { error: 'Decryption failed', details: e.message };
            return res.status(500).json(response);
        }

        // 3. Raw REST API Call (Locations)
        const url = `https://${shop}/admin/api/${LATEST_API_VERSION}/locations.json`;
        response.api_call = {
            url,
            method: 'GET',
        };

        const apiRes = await fetch(url, {
            headers: {
                'X-Shopify-Access-Token': token,
                'Content-Type': 'application/json',
            },
        });

        response.api_call.status = apiRes.status;
        response.api_call.statusText = apiRes.statusText;
        response.api_call.headers = {};
        apiRes.headers.forEach((v, k) => {
            response.api_call.headers[k] = v;
        });

        const text = await apiRes.text();
        try {
            const json = JSON.parse(text);
            response.api_call.body = json;
        } catch {
            response.api_call.body_raw = text;
        }

        // 4. Token Inspection (Access Scopes)
        // We can verify effective scopes by hitting /admin/oauth/access_scopes.json
        const scopeUrl = `https://${shop}/admin/oauth/access_scopes.json`;
        const scopeRes = await fetch(scopeUrl, {
            headers: {
                'X-Shopify-Access-Token': token,
            },
        });
        const scopeData = await scopeRes.json();
        response.effective_scopes = scopeData;

        res.status(200).json(response);

    } catch (error: any) {
        response.crash = { message: error.message, stack: error.stack };
        res.status(500).json(response);
    }
}
