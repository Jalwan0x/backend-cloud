import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { LATEST_API_VERSION } from '@shopify/shopify-api';

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
): Promise<{ success: boolean; error?: string; locationCount?: number; locationError?: string }> {
    try {
        let token = accessToken;

        // 1. Resolve Token if not provided
        if (!token) {
            const shop = await prisma.shop.findUnique({
                where: { shopDomain },
                select: { accessToken: true, needsReauth: true }
            });

            if (shop?.needsReauth) {
                console.log(`[Shop Details] Shop ${shopDomain} flagged for re-auth. Skipping fetch.`);
                return { success: false, error: 'Shop is flagged for re-authentication (reinstall required)' };
            }

            if (shop?.accessToken) {
                try {
                    token = decrypt(shop.accessToken);
                } catch (e) {
                    console.warn(`[Shop Details] Failed to decrypt token for ${shopDomain}. Skipping.`);
                    return { success: false, error: 'Failed to decrypt access token' };
                }
            }
        }

        if (!token) {
            console.warn(`[Shop Details] No token found for ${shopDomain}. Skipping detail fetch.`);
            return { success: false, error: 'No access token found in database' };
        }

        // 2. Call Shopify Admin API
        console.log(`[Shop Details] Fetching owner info from Shopify for ${shopDomain}...`);

        const response = await fetch(`https://${shopDomain}/admin/api/${LATEST_API_VERSION}/shop.json`, {
            method: 'GET',
            headers: {
                'X-Shopify-Access-Token': token,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[Shop Details] Failed to fetch shop info: ${response.status} ${errText}`);
            return { success: false, error: `Shopify API ${response.status}: ${errText}` };
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

        // 4. Sync Locations (Requested Feature)
        console.log(`[Shop Details] Syncing locations for ${shopDomain}...`);
        await syncLocations(shopDomain, token);

        return { success: true };

    } catch (error: any) {
        console.error(`[Shop Details] Unexpected error:`, error);
        return { success: false, error: error.message || 'Unknown internal error' };
    }
}

interface ShopifyLocationResponse {
    locations: {
        id: number;
        name: string;
        active: boolean;
        legacy: boolean;
    }[];
}

/**
 * Syncs Shopify Locations to local LocationSetting table.
 * De-duplicates by shopifyLocationId.
 */
export async function syncLocations(shopDomain: string, accessToken: string): Promise<boolean> {
    try {
        const response = await fetch(`https://${shopDomain}/admin/api/${LATEST_API_VERSION}/locations.json`, {
            method: 'GET',
            headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            console.error(`[Location Sync] Failed: ${response.status} ${await response.text()}`);
            return false;
        }

        const data = await response.json() as ShopifyLocationResponse;

        // Get internal Shop ID
        const shop = await prisma.shop.findUnique({ where: { shopDomain }, select: { id: true } });
        if (!shop) return false;

        console.log(`[Location Sync] Found ${data.locations.length} locations for ${shopDomain}`);

        for (const loc of data.locations) {
            // Skip legacy locations if needed, but usually we want all active physical locations
            // Using upsert to update name/active status if changed
            await prisma.locationSetting.upsert({
                where: {
                    shopId_shopifyLocationId: {
                        shopId: shop.id,
                        shopifyLocationId: loc.id.toString()
                    }
                },
                update: {
                    locationName: loc.name,
                    isActive: loc.active,
                    updatedAt: new Date(),
                },
                create: {
                    shopId: shop.id,
                    shopifyLocationId: loc.id.toString(),
                    locationName: loc.name,
                    isActive: loc.active,
                    priority: 0,
                    etaMin: 1,
                    etaMax: 2,
                    shippingCost: 0
                }
            });
        }

        return true;
    } catch (e) {
        console.error(`[Location Sync] Error syncing locations:`, e);
        return false;
    }
}
