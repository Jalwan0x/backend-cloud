import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encryption';

interface ShopifyShopResponse {
    shop: {
        id: number;
        name: string;
        email: string;
        domain: string;
        myshopify_domain: string;
        country: string;
        shop_owner: string;
        plan_name: string;
    };
}

/**
 * Fetches shop details (Owner Name, Email, Shop Name) from Shopify Admin API
 * and updates the local database.
 * 
 * @param shopDomain - The myshopify domain
 * @param accessToken - The Offline Access Token (if known, otherwise fetched from DB)
 * @returns boolean - true if successful
 */
export async function fetchAndSaveShopDetails(
    shopDomain: string,
    accessToken?: string
): Promise<boolean> {
    try {
        let token = accessToken;

        // 1. Resolve Token if not provided
        if (!token) {
            const shop = await prisma.shop.findUnique({
                where: { shopDomain },
                select: { accessToken: true }
            });
            if (shop?.accessToken) {
                token = decrypt(shop.accessToken);
            }
        }

        if (!token) {
            console.warn(`[Shop Details] No token found for ${shopDomain}. Skipping detail fetch.`);
            return false;
        }

        // 2. Call Shopify Admin API
        console.log(`[Shop Details] Fetching owner info from Shopify for ${shopDomain}...`);

        const response = await fetch(`https://${shopDomain}/admin/api/latest/shop.json`, {
            method: 'GET',
            headers: {
                'X-Shopify-Access-Token': token,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[Shop Details] Failed to fetch shop info: ${response.status} ${errText}`);
            // If 401, token might be invalid/revoked. We just fail quietly here.
            return false;
        }

        const data = await response.json() as ShopifyShopResponse;
        const shopData = data.shop;

        // 3. Update Database
        await prisma.shop.update({
            where: { shopDomain },
            data: {
                shopName: shopData.name,
                ownerEmail: shopData.email,
                ownerName: shopData.shop_owner,
                ownerFetchedAt: new Date(),
                updatedAt: new Date(),
            },
        });

        console.log(`[Shop Details] Successfully updated owner details: ${shopData.email}`);
        return true;

    } catch (error: any) {
        console.error(`[Shop Details] Unexpected error:`, error);
        return false;
    }
}
