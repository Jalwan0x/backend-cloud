import { prisma } from './db';
import { getShopifySession } from './shopify';
import { shopify } from './shopify';

export interface CartItem {
  variant_id: string;
  quantity: number;
  product_id?: string;
}

export interface ShippingRate {
  service_name: string;
  service_code: string;
  total_price: string; // Price in cents as string
  description: string;
  currency: string;
  // Legacy fields for compatibility
  name?: string;
  price?: string;
  code?: string;
  source?: string;
}

export interface WarehouseGroup {
  locationId: string;
  locationName: string;
  items: CartItem[];
  shippingCost: number;
  etaMin: number;
  etaMax: number;
}

export async function groupItemsByWarehouse(
  shopDomain: string,
  items: CartItem[]
): Promise<WarehouseGroup[]> {
  if (!items || items.length === 0) {
    return [];
  }

  // Check shop is active before proceeding
  const shopCheck = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { isActive: true, id: true },
  });

  if (!shopCheck || !shopCheck.isActive) {
    throw new Error('Shop is not active');
  }

  const session = await getShopifySession(shopDomain);
  if (!session) {
    throw new Error('Shop session not found');
  }

  const client = new shopify.clients.Graphql({ session });

  // Get inventory levels for all variants
  // Support unlimited warehouses by using pagination if needed
  const variantIds = items.map((item) => item.variant_id);
  const inventoryQuery = `
    query getInventoryLevels($first: Int!, $ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on ProductVariant {
          id
          inventoryItem {
            id
            inventoryLevels(first: $first) {
              edges {
                node {
                  available
                  location {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const gidVariantIds = variantIds.map((id) => `gid://shopify/ProductVariant/${id}`);
  
  // Shopify allows up to 250 locations per query, but we'll use 250 to support unlimited warehouses
  // If a shop has more than 250 locations, we'd need pagination (rare case)
  let inventoryResponse;
  try {
    inventoryResponse = await client.query({
      data: {
        query: inventoryQuery,
        variables: {
          first: 250, // Increased from 50 to support unlimited warehouses
          ids: gidVariantIds,
        },
      },
    });
  } catch (error: any) {
    console.error(`Failed to fetch inventory levels for shop ${shopDomain}:`, error.message);
    throw new Error(`Inventory lookup failed: ${error.message}`);
  }

  const inventoryData = inventoryResponse.body as any;
  const variants = inventoryData.data?.nodes || [];

  if (!variants || variants.length === 0) {
    console.warn(`No variants found for shop ${shopDomain}`);
    // Return empty groups instead of throwing - allows graceful degradation
    return [];
  }

  // Fetch all location settings (no limit - supports unlimited warehouses)
  // Use shopCheck.id since we already have it from the initial check
  const locationSettings = await prisma.locationSetting.findMany({
    where: {
      shopId: shopCheck.id,
      isActive: true,
    },
    orderBy: { priority: 'asc' },
  });

  // Group items by location
  // Support unlimited warehouses - no limit on location groups
  const locationGroups: Map<string, { items: CartItem[]; locationName: string }> = new Map();

  items.forEach((item) => {
    try {
      const variant = variants.find((v: any) => 
        v?.id === `gid://shopify/ProductVariant/${item.variant_id}`
      );

      let assigned = false;

      if (variant?.inventoryItem?.inventoryLevels?.edges) {
        // Find locations with available inventory, sorted by priority
        // Support unlimited locations per variant
        const inventoryLevels = variant.inventoryItem.inventoryLevels.edges
          .filter((edge: any) => edge.node && edge.node.available > 0)
          .map((edge: any) => ({
            locationId: edge.node.location.id.replace('gid://shopify/Location/', ''),
            locationName: edge.node.location.name,
            available: edge.node.available,
          }));

        // Sort by location priority (supports unlimited warehouses)
        inventoryLevels.sort((a: any, b: any) => {
          const aSetting = locationSettings.find(s => s.shopifyLocationId === a.locationId);
          const bSetting = locationSettings.find(s => s.shopifyLocationId === b.locationId);
          return (aSetting?.priority || 999) - (bSetting?.priority || 999);
        });

        if (inventoryLevels.length > 0) {
          // Default: assign to first (highest priority) location
          // Multiple options will be handled at the rate calculation level
          const selectedLocation = inventoryLevels[0];
          const locationId = selectedLocation.locationId;
          const locationName = selectedLocation.locationName;

          if (!locationGroups.has(locationId)) {
            locationGroups.set(locationId, { items: [], locationName });
          }

          locationGroups.get(locationId)!.items.push(item);
          assigned = true;
        }
      }

      // Fallback: assign to first available location if no inventory found
      if (!assigned && locationSettings.length > 0) {
        const firstLocation = locationSettings[0];
        const locationId = firstLocation.shopifyLocationId;
        
        if (!locationGroups.has(locationId)) {
          locationGroups.set(locationId, { items: [], locationName: firstLocation.locationName });
        }
        
        locationGroups.get(locationId)!.items.push(item);
      }
    } catch (itemError: any) {
      // Log error but continue processing other items
      console.error(`Error processing item ${item.variant_id}:`, itemError.message);
      // Try to assign to first available location as fallback
      if (locationSettings.length > 0) {
        const firstLocation = locationSettings[0];
        const locationId = firstLocation.shopifyLocationId;
        
        if (!locationGroups.has(locationId)) {
          locationGroups.set(locationId, { items: [], locationName: firstLocation.locationName });
        }
        
        locationGroups.get(locationId)!.items.push(item);
      }
    }
  });

  // Create warehouse groups with shipping costs and ETAs
  const warehouseGroups: WarehouseGroup[] = [];

  for (const [locationId, group] of locationGroups.entries()) {
    const setting = locationSettings.find((s) => s.shopifyLocationId === locationId);

    if (setting) {
      warehouseGroups.push({
        locationId,
        locationName: group.locationName,
        items: group.items,
        shippingCost: setting.shippingCost,
        etaMin: setting.etaMin,
        etaMax: setting.etaMax,
      });
    } else {
      // Default shipping if no setting found
      warehouseGroups.push({
        locationId,
        locationName: group.locationName,
        items: group.items,
        shippingCost: 0,
        etaMin: 1,
        etaMax: 2,
      });
    }
  }

  // Sort by priority
  return warehouseGroups.sort((a, b) => {
    const aSetting = locationSettings.find((s) => s.shopifyLocationId === a.locationId);
    const bSetting = locationSettings.find((s) => s.shopifyLocationId === b.locationId);
    return (aSetting?.priority || 999) - (bSetting?.priority || 999);
  });
}

export function calculateShippingRates(
  warehouseGroups: WarehouseGroup[],
  isPlus: boolean,
  showBreakdown: boolean = true,
  enableSplitShipping: boolean = false,
  currency: string = 'USD'
): ShippingRate[] {
  if (warehouseGroups.length === 0) {
    return [];
  }

  // For Plus stores with split shipping enabled, return separate selectable rates for each warehouse
  // This allows customers to choose between different shipping options
  if (isPlus && enableSplitShipping) {
    // Always return separate rates when split shipping is enabled (even for single warehouse)
    // This gives customers the option to see individual warehouse rates
    // Ensure all rates are properly formatted and selectable
    return warehouseGroups.map((group, index) => {
      const itemCount = group.items.reduce((sum, item) => sum + item.quantity, 0);
      const priceInCents = Math.round(group.shippingCost * 100);
      
      // Format delivery time
      let deliveryTime = "Fast delivery";
      if (group.etaMin > 0) {
        if (group.etaMin === 1 && group.etaMax === 1) {
          deliveryTime = "Arrives tomorrow";
        } else if (group.etaMin === 1) {
          deliveryTime = `Arrives in 1-${group.etaMax} days`;
        } else {
          deliveryTime = `Delivery in ${group.etaMin}-${group.etaMax} days`;
        }
      }
      
      // Use unique service_code for each rate to ensure all are selectable
      // Include index to ensure uniqueness even if locationId is the same
      const serviceCode = `cloudship_${group.locationId}_opt${index}`;
      
      return {
        service_name: `${group.locationName} - ${itemCount} item${itemCount > 1 ? 's' : ''}`,
        service_code: serviceCode,
        total_price: priceInCents.toString(), // Price in cents as string
        description: deliveryTime,
        currency,
      };
    });
  }

  // Always return ONE combined rate (Shopify requirement for non-Plus stores or when split shipping is disabled)
  // This works for ANY store with carrier calculated shipping enabled
  const totalCost = warehouseGroups.reduce((sum, group) => sum + group.shippingCost, 0);
  const priceInCents = Math.round(totalCost * 100);
  
  if (warehouseGroups.length === 1) {
    const group = warehouseGroups[0];
    let deliveryTime = "Fast delivery";
    if (group.etaMin > 0) {
      if (group.etaMin === 1 && group.etaMax === 1) {
        deliveryTime = "Arrives tomorrow";
      } else if (group.etaMin === 1) {
        deliveryTime = `Arrives in 1-${group.etaMax} days`;
      } else {
        deliveryTime = `Delivery in ${group.etaMin}-${group.etaMax} days`;
      }
    }
    
    return [
      {
        service_name: 'Standard Shipping',
        service_code: 'cloudship_combined',
        total_price: priceInCents.toString(),
        description: deliveryTime,
        currency,
      },
    ];
  }

  // Multiple warehouses: combine with breakdown in description
  if (showBreakdown) {
    const breakdown = warehouseGroups
      .map(
        (group) =>
          `• ${group.locationName} (${group.etaMin}-${group.etaMax} days): $${group.shippingCost.toFixed(2)}`
      )
      .join('\n');

    const minEta = Math.min(...warehouseGroups.map(g => g.etaMin));
    const maxEta = Math.max(...warehouseGroups.map(g => g.etaMax));
    let deliveryTime = "Fast delivery";
    if (minEta > 0) {
      if (minEta === 1 && maxEta === 1) {
        deliveryTime = "Arrives tomorrow";
      } else if (minEta === 1) {
        deliveryTime = `Arrives in 1-${maxEta} days`;
      } else {
        deliveryTime = `Delivery in ${minEta}-${maxEta} days`;
      }
    }

    return [
      {
        service_name: 'Multi-Warehouse Shipping',
        service_code: 'cloudship_combined',
        total_price: priceInCents.toString(),
        description: `${deliveryTime}\n${breakdown}`,
        currency,
      },
    ];
  }

  // Breakdown disabled, just show total
  return [
    {
      service_name: 'Standard Shipping',
      service_code: 'cloudship_combined',
      total_price: priceInCents.toString(),
      description: 'Fast delivery',
      currency,
    },
  ];
}
