import type { NextApiRequest, NextApiResponse } from 'next';
import { getShopifySession } from '@/lib/shopify';
import { groupItemsByWarehouse, calculateShippingRates, CartItem } from '@/lib/shipping';
import { prisma } from '@/lib/db';
import { verifyAppProxyRequest } from '@/lib/webhook-verification';

interface ShippingRateRequest {
  rate: {
    origin: {
      country: string;
      province?: string;
      city?: string;
      zip?: string;
    };
    destination: {
      country: string;
      province?: string;
      city?: string;
      zip?: string;
    };
    items: Array<{
      name: string;
      sku?: string;
      quantity: number;
      grams: number;
      price: number;
      vendor?: string;
      requires_shipping: boolean;
      taxable: boolean;
      fulfillment_service?: string;
      product_id?: number;
      variant_id?: number;
    }>;
    currency?: string;
    locale?: string;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Always return valid JSON response, even on errors (Shopify requirement)
  try {
    // Verify request is from Shopify
    if (!verifyAppProxyRequest(req.query as Record<string, string | string[]>)) {
      console.warn('Unauthorized shipping rate request');
      return res.json({ rates: [] }); // Return empty rates instead of error
    }

    const shop = req.query.shop as string;
    if (!shop) {
      console.warn('Missing shop parameter in shipping rate request');
      return res.json({ rates: [] });
    }

    // CRITICAL: Check if shop is active FIRST (app uninstalled check)
    let shopRecord;
    try {
      shopRecord = await prisma.shop.findUnique({
        where: { shopDomain: shop },
        select: { isActive: true, id: true },
      });
    } catch (dbError: any) {
      console.error(`Database error checking shop ${shop}:`, dbError.message);
      return res.json({ rates: [] }); // Return empty rates on DB error
    }

    // If shop doesn't exist or is not active (uninstalled), return empty rates immediately
    if (!shopRecord || !shopRecord.isActive) {
      console.log(`Shop ${shop} is not active or not found (app uninstalled), returning empty rates`);
      return res.json({ rates: [] });
    }

    // Get session - this also checks isActive internally
    let session;
    try {
      session = await getShopifySession(shop);
      if (!session) {
        console.warn(`No session found for shop ${shop}`);
        return res.json({ rates: [] });
      }
    } catch (sessionError: any) {
      console.error(`Session error for shop ${shop}:`, sessionError.message);
      return res.json({ rates: [] });
    }

    // Parse request body with error handling
    let body: ShippingRateRequest;
    try {
      body = req.body;
      if (!body || !body.rate) {
        console.warn(`Invalid request body for shop ${shop}`);
        return res.json({ rates: [] });
      }
    } catch (parseError: any) {
      console.error(`Failed to parse request body for shop ${shop}:`, parseError.message);
      return res.json({ rates: [] });
    }

    // Extract and validate cart items
    let cartItems: CartItem[];
    try {
      cartItems = (body.rate.items || [])
        .filter((item) => item.variant_id && item.requires_shipping)
        .map((item) => ({
          variant_id: String(item.variant_id!),
          quantity: item.quantity || 1,
          product_id: item.product_id ? String(item.product_id) : undefined,
        }));

      if (cartItems.length === 0) {
        return res.json({ rates: [] });
      }
    } catch (itemError: any) {
      console.error(`Error processing cart items for shop ${shop}:`, itemError.message);
      return res.json({ rates: [] });
    }

    // Extract currency from request
    const currency = typeof body.rate.currency === 'string' && body.rate.currency.length === 3
      ? body.rate.currency
      : 'USD';

    // Group items by warehouse with error handling
    let warehouseGroups;
    try {
      warehouseGroups = await groupItemsByWarehouse(shop, cartItems);
      if (!warehouseGroups || warehouseGroups.length === 0) {
        console.warn(`No warehouse groups found for shop ${shop}`);
        return res.json({ rates: [] });
      }
    } catch (groupError: any) {
      console.error(`Error grouping items by warehouse for shop ${shop}:`, groupError.message);
      return res.json({ rates: [] });
    }

    // Get shop settings with error handling
    let shopData;
    try {
      shopData = await prisma.shop.findUnique({
        where: { shopDomain: shop },
        select: { isPlus: true, showBreakdown: true, enableSplitShipping: true, isActive: true },
      });

      // Double-check isActive (in case it changed during processing)
      if (!shopData || !shopData.isActive) {
        console.log(`Shop ${shop} became inactive during processing, returning empty rates`);
        return res.json({ rates: [] });
      }
    } catch (settingsError: any) {
      console.error(`Error fetching shop settings for ${shop}:`, settingsError.message);
      return res.json({ rates: [] });
    }

    const isPlus = shopData?.isPlus || false;
    const showBreakdown = shopData?.showBreakdown !== false;
    const enableSplitShipping = shopData?.enableSplitShipping || false;

    // Calculate shipping rates with error handling
    let rates;
    try {
      rates = calculateShippingRates(warehouseGroups, isPlus, showBreakdown, enableSplitShipping, currency);
      if (!rates || rates.length === 0) {
        console.warn(`No rates calculated for shop ${shop}`);
        return res.json({ rates: [] });
      }
    } catch (rateError: any) {
      console.error(`Error calculating shipping rates for shop ${shop}:`, rateError.message);
      return res.json({ rates: [] });
    }

    // Return rates
    return res.json({ rates });
  } catch (error: any) {
    // Catch-all error handler - always return valid JSON
    console.error('Unexpected error in shipping rates endpoint:', error);
    return res.json({ rates: [] }); // Always return empty rates, never error status
  }
}
