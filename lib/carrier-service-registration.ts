import { getShopifySession } from './shopify';
import { shopify } from './shopify';
import { prisma } from './db';

export async function registerCarrierService(shopDomain: string): Promise<void> {
  const session = await getShopifySession(shopDomain);
  if (!session) {
    throw new Error('Shop session not found');
  }

  const appUrl = process.env.SHOPIFY_APP_URL || '';
  const carrierServiceUrl = `${appUrl}/api/shipping-rates?shop=${shopDomain}`;

  try {
    // Use REST Admin API to register CarrierService
    const client = new shopify.clients.Rest({ session });
    
    // Check if CarrierService already exists
    const existingServices = await client.get({
      path: 'carrier_services',
    });

    const services = existingServices.body as any;
    const existingService = services?.carrier_services?.find(
      (service: any) => service.callback_url === carrierServiceUrl
    );

    if (existingService) {
      console.log(`CarrierService already registered for ${shopDomain}:`, existingService.id);
      return;
    }

    // Register new CarrierService
    const response = await client.post({
      path: 'carrier_services',
      data: {
        carrier_service: {
          name: 'Cloudship Shipping',
          callback_url: carrierServiceUrl,
          service_discovery: false,
        },
      },
    });

    const service = response.body as any;
    if (service?.carrier_service?.id) {
      console.log(`CarrierService registered successfully for ${shopDomain}:`, service.carrier_service.id);
    } else {
      console.error('Failed to register CarrierService:', service);
    }
  } catch (error: any) {
    console.error(`Failed to register CarrierService for ${shopDomain}:`, error.message);
  }
}

export async function unregisterCarrierService(shopDomain: string): Promise<void> {
  try {
    const shopRecord = await prisma.shop.findUnique({
      where: { shopDomain },
      select: { scopes: true, accessToken: true },
    });

    if (!shopRecord) {
      console.log(`Shop not found for ${shopDomain}, skipping CarrierService unregistration`);
      return;
    }

    // Try to get session to unregister CarrierService
    // Note: After uninstall, the access token is revoked, so we may not be able to unregister
    // But we'll try anyway
    try {
      const session = await getShopifySession(shopDomain);
      if (!session) {
        console.log(`Cannot get session for ${shopDomain}, CarrierService will remain registered`);
        return;
      }

      const client = new shopify.clients.Rest({ session });
      const appUrl = process.env.SHOPIFY_APP_URL || '';
      const carrierServiceUrl = `${appUrl}/api/shipping-rates?shop=${shopDomain}`;

      // Get all CarrierServices
      const existingServices = await client.get({
        path: 'carrier_services',
      });

      const services = existingServices.body as any;
      const serviceToDelete = services?.carrier_services?.find(
        (service: any) => service.callback_url === carrierServiceUrl
      );

      if (serviceToDelete) {
        // Delete the CarrierService
        await client.delete({
          path: `carrier_services/${serviceToDelete.id}`,
        });
        console.log(`CarrierService unregistered successfully for ${shopDomain}`);
      } else {
        console.log(`CarrierService not found for ${shopDomain}, may have been already deleted`);
      }
    } catch (error: any) {
      // Access token is likely revoked after uninstall, so this is expected
      console.log(`Cannot unregister CarrierService for ${shopDomain} (token likely revoked):`, error.message);
    }
  } catch (error: any) {
    console.error(`Failed to unregister CarrierService for ${shopDomain}:`, error.message);
  }
}
