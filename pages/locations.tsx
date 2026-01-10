import { useState, useEffect, useCallback } from 'react';
import {
  Page,
  Layout,
  Card,
  DataTable,
  Button,
  Modal,
  TextField,
  Badge,
  Banner,
  InlineStack,
  Text,
  BlockStack,
  Checkbox,
  Divider,
  EmptyState,
  Icon,
  Box,
  Grid,
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
              console.log(`[Locations Page] Extracted shop from host: ${shopDomain}`);
            }
          } catch (e) {
            console.warn('[Locations Page] Could not decode host parameter:', e);
          }
        }
      }

      if (shopDomain) {
        setShop(shopDomain);
        console.log(`[Locations Page] Shop set to: ${shopDomain}`);
      } else {
        console.error('[Locations Page] No shop found in URL or host parameter');
        console.error('[Locations Page] URL:', window.location.href);
        console.error('[Locations Page] Query params:', Object.fromEntries(params));
      }
    }
  }, []);

  const [locations, setLocations] = useState<Location[]>([]);
  const [settings, setSettings] = useState<LocationSetting[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [modalActive, setModalActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shopSettings, setShopSettings] = useState({
    showBreakdown: true,
    sumRates: true,
    enableSplitShipping: false,
    isPlus: false,
  });
  const [formData, setFormData] = useState({
    shippingCost: '0',
    etaMin: '1',
    etaMax: '2',
    priority: '0',
  });
  const [debugInfo, setDebugInfo] = useState<{ scopes?: string } | null>(null);

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

    console.log(`[Locations Page] Fetching locations for shop: ${normalizedShop}`);

    try {
      const res = await fetch(`/api/locations?shop=${encodeURIComponent(normalizedShop)}`);
      const data = await res.json();
      console.log(`[Locations Page] Response status: ${res.status}, data:`, data);

      if (!res.ok) {
        console.error(`[Locations Page] API error (${res.status}): ${data.error || 'Unknown error'}`);
        // If 401, shop might not be authenticated - show error
        if (res.status === 401) {
          console.error(`[Locations Page] Shop not authenticated. Shop domain: ${normalizedShop}`);

          if (data.reauth) {
            console.log('[Locations Page] Triggering Re-Auth Redirect...');
            const appOrigin = 'https://backend-cloud-jzom.onrender.com';
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
            console.log('[Locations Page] Using window.top fallback for redirect');
            const target = window.top || window;
            target.location.href = authUrl;
            return;
          }


        }
        setLocations([]);
        return;
      }

      if (data.locations && Array.isArray(data.locations)) {
        console.log(`[Locations Page] Setting ${data.locations.length} locations:`, data.locations);
        setLocations(data.locations);
      } else {
        console.warn(`[Locations Page] No locations in response or invalid format:`, data);
        setLocations([]);
      }
      if (data.debug) {
        setDebugInfo(data.debug);
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
      if (res.ok) {
        const data = await res.json();
        setShopSettings((prev) => ({ ...prev, [field]: data[field] }));
      }
    } catch (error) {
      console.error('Failed to update shop settings:', error);
    }
  };

  useEffect(() => {
    fetchLocations();
    fetchSettings();
    fetchShopSettings();
  }, [fetchLocations, fetchSettings, fetchShopSettings]);

  const handleLocationClick = (location: Location) => {
    const existingSetting = settings.find((s) => s.shopifyLocationId === location.id);

    if (existingSetting) {
      setFormData({
        shippingCost: existingSetting.shippingCost.toString(),
        etaMin: existingSetting.etaMin.toString(),
        etaMax: existingSetting.etaMax.toString(),
        priority: existingSetting.priority.toString(),
      });
    } else {
      setFormData({
        shippingCost: '0',
        etaMin: '1',
        etaMax: '2',
        priority: '0',
      });
    }

    setSelectedLocation(location);
    setModalActive(true);
  };

  const handleSave = async () => {
    if (!selectedLocation || !shop) return;

    setLoading(true);
    const existingSetting = settings.find((s) => s.shopifyLocationId === selectedLocation.id);

    // Normalize shop domain
    let normalizedShop = shop.toLowerCase().trim();
    if (!normalizedShop.includes('.myshopify.com')) {
      normalizedShop = `${normalizedShop}.myshopify.com`;
    }

    try {
      if (existingSetting) {
        const res = await fetch(`/api/locations/settings?shop=${encodeURIComponent(normalizedShop)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: existingSetting.id,
            ...formData,
          }),
        });
        if (res.ok) {
          setModalActive(false);
          fetchSettings();
        }
      } else {
        const res = await fetch(`/api/locations/settings?shop=${encodeURIComponent(normalizedShop)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shopifyLocationId: selectedLocation.id,
            locationName: selectedLocation.name,
            ...formData,
          }),
        });
        if (res.ok) {
          setModalActive(false);
          fetchSettings();
        }
      }
    } catch (error) {
      console.error('Failed to save setting:', error);
    } finally {
      setLoading(false);
    }
  };

  const tableRows = locations.map((location) => {
    const setting = settings.find((s) => s.shopifyLocationId === location.id);
    const hasSetting = !!setting;

    return [
      location.name,
      location.address?.city || '-',
      location.address?.country || '-',
      hasSetting ? (
        <Badge key={setting.id} tone={setting.isActive ? 'success' : 'warning'}>
          {`$${setting.shippingCost.toFixed(2)} (${setting.etaMin}-${setting.etaMax} days)`}
        </Badge>
      ) : (
        <Badge key={`not-configured-${location.id}`}>Not configured</Badge>
      ),
      <Button key={`btn-${location.id}`} size="micro" onClick={() => handleLocationClick(location)}>
        {hasSetting ? 'Edit' : 'Configure'}
      </Button>,
    ];
  });

  return (
    <Page
      title="Warehouse Shipping Settings"
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
                Configure shipping costs and delivery times for each warehouse location. Your customers will see transparent shipping information based on where their items are located.
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
                  {debugInfo?.scopes && (
                    <Box paddingBlockStart="400">
                      <Banner tone="warning" title="Debug Information">
                        <p><strong>Current Scopes:</strong> {debugInfo.scopes}</p>
                        <p>Required: <code>read_locations</code></p>
                        {!debugInfo.scopes.includes('read_locations') && (
                          <p><strong>ACTION REQUIRED:</strong> You are missing permission to view locations. Please reinstall/update the app.</p>
                        )}
                      </Banner>
                    </Box>
                  )}
                </EmptyState>
              ) : (
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                  headings={['Location Name', 'City', 'Country', 'Shipping Settings', 'Actions']}
                  rows={tableRows}
                  increasedTableDensity
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={modalActive}
        onClose={() => setModalActive(false)}
        title={`Configure Shipping: ${selectedLocation?.name || ''}`}
        primaryAction={{
          content: 'Save Settings',
          onAction: handleSave,
          loading,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setModalActive(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="500">
            <Text variant="bodyMd" tone="subdued" as="p">
              Configure shipping costs and delivery times for this warehouse location. These settings will be used when calculating shipping rates for items from this location.
            </Text>
            <Divider />
            <BlockStack gap="400">
              <TextField
                label="Shipping Cost"
                type="number"
                value={formData.shippingCost}
                onChange={(value) => setFormData({ ...formData, shippingCost: value })}
                prefix="$"
                autoComplete="off"
                helpText="Base shipping cost for items from this warehouse"
              />
              <Grid>
                <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 6, xl: 6 }}>
                  <TextField
                    label="Minimum Delivery Time"
                    type="number"
                    value={formData.etaMin}
                    onChange={(value) => setFormData({ ...formData, etaMin: value })}
                    autoComplete="off"
                    helpText="Minimum days for delivery"
                  />
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 6, xl: 6 }}>
                  <TextField
                    label="Maximum Delivery Time"
                    type="number"
                    value={formData.etaMax}
                    onChange={(value) => setFormData({ ...formData, etaMax: value })}
                    autoComplete="off"
                    helpText="Maximum days for delivery"
                  />
                </Grid.Cell>
              </Grid>
              <TextField
                label="Priority"
                type="number"
                value={formData.priority}
                onChange={(value) => setFormData({ ...formData, priority: value })}
                autoComplete="off"
                helpText="Lower numbers = higher priority. When items are available at multiple warehouses, this location will be preferred if it has a lower priority number."
              />
            </BlockStack>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
