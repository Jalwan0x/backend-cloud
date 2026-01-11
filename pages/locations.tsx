import { useState, useEffect, useCallback } from 'react';
import {
  Page,
  Layout,
  Card,
  DataTable,
  // Button,
  // Modal,
  // TextField,
  Badge,
  Banner,
  InlineStack,
  Text,
  BlockStack,
  Checkbox,
  Divider,
  EmptyState,
  // Icon,
  Box,
  // Grid,
} from '@shopify/polaris';
import { useRouter } from 'next/router';
import { createApp } from '@shopify/app-bridge';
import { Redirect } from '@shopify/app-bridge/actions';

interface Location {
  id: string;
  name: string;
  address: {
    address1?: string;
    city?: string;
    province?: string;
    country?: string;
    zip?: string;
  };
  active: boolean;
}

interface LocationSetting {
  id: string;
  shopifyLocationId: string;
  locationName: string;
  shippingCost: number;
  etaMin: number;
  etaMax: number;
  priority: number;
  isActive: boolean;
}

export default function LocationsPage() {
  const router = useRouter();

  const [shop, setShop] = useState<string>('');

  // Extract shop from URL or host parameter
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      let shopDomain = params.get('shop') || '';

      // If no shop in query, try to extract from host parameter (embedded app)
      if (!shopDomain) {
        const host = params.get('host');
        if (host) {
          // Host format: YWRtaW4uc2hvcGlmeS5jb20vc3RvcmUvY2xvdXNoaXAtdGVzdA
          // Decode base64 to get: admin.shopify.com/store/clouship-test
          try {
            const decoded = atob(host);
            const match = decoded.match(/store\/([^\/]+)/);
            if (match && match[1]) {
              shopDomain = `${match[1]}.myshopify.com`;

            }
          } catch (e) {
            console.warn('[Locations Page] Could not decode host parameter:', e);
          }
        }
      }

      if (shopDomain) {
        setShop(shopDomain);

      } else {
        console.error('[Locations Page] No shop found in URL or host parameter');
        console.error('[Locations Page] URL:', window.location.href);
        console.error('[Locations Page] Query params:', Object.fromEntries(params));
      }
    }
  }, []);

  const [locations, setLocations] = useState<Location[]>([]);
  const [settings, setSettings] = useState<LocationSetting[]>([]);
  // const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  // const [modalActive, setModalActive] = useState(false);
  // const [loading, setLoading] = useState(false);
  const [shopSettings, setShopSettings] = useState({
    showBreakdown: true,
    sumRates: true,
    enableSplitShipping: false,
    isPlus: false,
  });
  // const [formData, setFormData] = useState({
  //   shippingCost: '0',
  //   etaMin: '1',
  //   etaMax: '2',
  //   priority: '0',
  // });
  const [isUninstalled, setIsUninstalled] = useState(false);

  const fetchLocations = useCallback(async () => {
    if (!shop) {
      console.warn('[Locations Page] No shop parameter found');
      return;
    }

    // Normalize shop domain
    let normalizedShop = shop.toLowerCase().trim();
    if (!normalizedShop.includes('.myshopify.com')) {
      normalizedShop = `${normalizedShop}.myshopify.com`;
    }



    try {
      const res = await fetch(`/api/locations?shop=${encodeURIComponent(normalizedShop)}`);
      const data = await res.json();


      if (!res.ok) {
        // Enforce Uninstall Block
        if (res.status === 403 && data.uninstalled) {
          setIsUninstalled(true);
          return;
        }

        console.error(`[Locations Page] API error (${res.status}): ${data.error || 'Unknown error'}`);
        // If 401, shop might not be authenticated - show error
        if (res.status === 401) {
          console.error(`[Locations Page] Shop not authenticated. Shop domain: ${normalizedShop}`);

          if (data.reauth) {

            const appOrigin = process.env.NEXT_PUBLIC_SHOPIFY_APP_URL || 'https://backend-cloud-jzom.onrender.com';
            const authUrl = `${appOrigin}/api/auth/begin?shop=${encodeURIComponent(normalizedShop)}`;

            const host = new URLSearchParams(window.location.search).get('host');
            const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;

            if (host && apiKey) {
              try {
                const app = createApp({ apiKey, host, forceRedirect: true });
                const redirect = Redirect.create(app);
                redirect.dispatch(Redirect.Action.REMOTE, authUrl);
                return;
              } catch (e) {
                console.warn('[Locations Page] App Bridge Redirect failed:', e);
              }
            }

            // Fallback: Force top-level navigation (Standard)

            const target = window.top || window;
            target.location.href = authUrl;
            return;
          }
        }
        setLocations([]);
        return;
      }

      if (data.locations && Array.isArray(data.locations)) {

        setLocations(data.locations);
      } else {
        console.warn(`[Locations Page] No locations in response or invalid format:`, data);
        setLocations([]);
      }
    } catch (error: any) {
      console.error('[Locations Page] Failed to fetch locations:', error);
      setLocations([]);
    }
  }, [shop]);

  const fetchSettings = useCallback(async () => {
    if (!shop) return;
    try {
      const res = await fetch(`/api/locations/settings?shop=${encodeURIComponent(shop)}`);
      const data = await res.json();

      if (res.status === 403 && data.uninstalled) {
        setIsUninstalled(true);
        return;
      }

      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  }, [shop]);

  const fetchShopSettings = useCallback(async () => {
    if (!shop) return;

    // Normalize shop domain
    let normalizedShop = shop.toLowerCase().trim();
    if (!normalizedShop.includes('.myshopify.com')) {
      normalizedShop = `${normalizedShop}.myshopify.com`;
    }

    try {
      const res = await fetch(`/api/shop/settings?shop=${encodeURIComponent(normalizedShop)}`);
      const data = await res.json();

      if (res.status === 403 && data.uninstalled) {
        setIsUninstalled(true);
        return;
      }

      if (data.shop) {
        setShopSettings({
          showBreakdown: data.shop.showBreakdown ?? true,
          sumRates: data.shop.sumRates ?? true,
          enableSplitShipping: data.shop.enableSplitShipping ?? false,
          isPlus: data.shop.isPlus ?? false,
        });
      }
    } catch (error) {
      console.error('Failed to fetch shop settings:', error);
    }
  }, [shop]);

  const updateShopSettings = async (field: string, value: boolean) => {
    if (!shop) return;
    try {
      const res = await fetch(`/api/shop/settings?shop=${encodeURIComponent(shop)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });

      if (res.status === 403) {
        setIsUninstalled(true);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setShopSettings((prev) => ({ ...prev, [field]: data[field] }));
      }
    } catch (error) {
      console.error('Failed to update shop settings:', error);
    }
  };

  const checkBilling = useCallback(async () => {
    if (!shop) return;
    try {
      // 1. Check with backend
      const res = await fetch(`/api/billing/check?shop=${encodeURIComponent(shop)}`);
      const data = await res.json();

      if (res.status === 402 && data.confirmationUrl) {
        console.log('[Locations Page] Billing Check: Payment Required. Redirecting...');

        // 2. Redirect to Shopify Billing using App Bridge
        const appOrigin = process.env.NEXT_PUBLIC_SHOPIFY_APP_URL || 'https://backend-cloud-jzom.onrender.com'; // Dynamic Fallback
        const host = new URLSearchParams(window.location.search).get('host');
        const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;

        if (host && apiKey) {
          const app = createApp({ apiKey, host, forceRedirect: true });
          const redirect = Redirect.create(app);
          redirect.dispatch(Redirect.Action.REMOTE, data.confirmationUrl);
        } else {
          // Fallback
          window.top!.location.href = data.confirmationUrl;
        }
      }
    } catch (e) {
      console.warn('Billing check failed:', e);
    }
  }, [shop]);

  useEffect(() => {
    fetchLocations();
    fetchSettings();
    fetchShopSettings();
    checkBilling(); // <-- Add billing check
  }, [fetchLocations, fetchSettings, fetchShopSettings, checkBilling]);

  const tableRows = locations.map((location) => {
    return [
      location.name,
      location.address?.city || '-',
      location.address?.country || '-',
    ];
  });

  if (isUninstalled) {
    return (
      <Page title="Cloudship">
        <Layout>
          <Layout.Section>
            <EmptyState
              heading="App Uninstalled"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              action={{
                content: 'Reinstall App',
                onAction: () => {
                  const appOrigin = process.env.NEXT_PUBLIC_SHOPIFY_APP_URL || 'https://backend-cloud-jzom.onrender.com';
                  const authUrl = `${appOrigin}/api/auth/begin?shop=${encodeURIComponent(shop)}`;
                  window.top!.location.href = authUrl;
                }
              }}
            >
              <p>This app has been uninstalled. Please reinstall it to continue using Cloudship features.</p>
            </EmptyState>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title="Warehouse Locations"
      primaryAction={{
        content: 'Refresh',
        onAction: () => {
          fetchLocations();
          fetchSettings();
          fetchShopSettings();
        },
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingLg" as="h2">
                Welcome to Cloudship
              </Text>
              <Text variant="bodyMd" tone="subdued" as="p">
                Your warehouse locations are synced from Shopify. Split shipping options will apply automatically based on your plan settings below.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="500">
              <Text variant="headingMd" as="h2">
                Shipping Display Options
              </Text>
              <Divider />
              <BlockStack gap="400">
                <Checkbox
                  label="Show detailed breakdown to customers"
                  checked={shopSettings.showBreakdown}
                  onChange={(value) => updateShopSettings('showBreakdown', value)}
                  helpText="Display a breakdown of shipping costs and delivery times per warehouse in the checkout description. This helps customers understand which items ship from which location."
                />
                <Checkbox
                  label="Sum rates into one total"
                  checked={shopSettings.sumRates}
                  onChange={(value) => updateShopSettings('sumRates', value)}
                  helpText="Combine all warehouse shipping costs into a single total when split shipping is not enabled."
                />
                {shopSettings.isPlus && (
                  <Box paddingBlockStart="400">
                    <Checkbox
                      label="Enable split shipping (Advanced/Plus only)"
                      checked={shopSettings.enableSplitShipping}
                      onChange={(value) => updateShopSettings('enableSplitShipping', value)}
                      helpText="Allow customers to select individual shipping options for items from different warehouses. This gives customers more control over their shipping experience."
                    />
                  </Box>
                )}
                {!shopSettings.isPlus && (
                  <Box paddingBlockStart="400">
                    <Banner tone="info">
                      <p>
                        <strong>Advanced/Plus Feature:</strong> Split shipping options are available for Advanced Shopify and Shopify Plus merchants.
                        CloudShip requires access to Shopify&apos;s Carrier Calculated Shipping API, which is automatically included with Advanced Shopify and Shopify Plus.
                        For Standard Shopify and Grow plans, you can enable it by either paying an extra $20/month or switching to annual billing.
                      </p>
                    </Banner>
                  </Box>
                )}
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingMd" as="h2">
                  Warehouse Locations
                </Text>
                <Badge tone={locations.length > 0 ? 'success' : 'attention'}>
                  {`${locations.length} ${locations.length === 1 ? 'location' : 'locations'}`}
                </Badge>
              </InlineStack>
              <Divider />
              {locations.length === 0 ? (
                <EmptyState
                  heading="No locations found"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>No warehouse locations are available. Make sure you have locations configured in your Shopify store.</p>
                </EmptyState>
              ) : (
                <DataTable
                  columnContentTypes={['text', 'text', 'text']}
                  headings={['Location Name', 'City', 'Country']}
                  rows={tableRows}
                  increasedTableDensity
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
