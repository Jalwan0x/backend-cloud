import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Page,
  Layout,
  Card,
  DataTable,
  Badge,
  Text,
  BlockStack,
  InlineStack,
  EmptyState,
  Banner,
  Divider,
  Button,
  Spinner,
  TextField,
  Modal,
} from '@shopify/polaris';

interface Shop {
  id: string;
  shopDomain: string;
  shopifyId: string;
  isActive: boolean;
  isPlus: boolean;
  ownerEmail?: string;
  ownerName?: string;
  shopName?: string;
  createdAt: string;
  updatedAt: string;
  locationSettingsCount?: number;
}

export default function AdminPage() {
  const router = useRouter();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/admin/shops', {
        credentials: 'include',
      });
      if (res.status === 401) {
        setAuthorized(false);
        setShowLogin(true);
        setLoading(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data.shops) {
          setShops(data.shops);
          setAuthorized(true);
        }
      } else {
        setError('Failed to load shops');
        setAuthorized(false);
      }
    } catch (err: any) {
      console.error('Auth check failed:', err);
      setError(err.message || 'Failed to check authentication');
      setAuthorized(false);
      setShowLogin(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchShops = async () => {
    setLoading(true);
    setError(null);
    try {
      // First test database connection
      const testRes = await fetch('/api/admin/test-db', {
        credentials: 'include',
      });
      const testData = await testRes.json();
      console.log('[Admin Page] Test DB result:', testData);

      // Then fetch shops with details
      const res = await fetch('/api/admin/shops', {
        credentials: 'include',
      });
      const data = await res.json();
      
      console.log('[Admin Page] Shops API response:', { status: res.status, data });
      
      if (res.status === 401) {
        setAuthorized(false);
        setShowLogin(true);
        return;
      }

      if (!res.ok) {
        setAuthorized(false);
        setError(data.error || 'Failed to load shops');
        return;
      }

      if (data.shops) {
        console.log(`[Admin Page] Received ${data.shops.length} shops:`, data.shops);
        setShops(data.shops);
        setAuthorized(true);
      } else if (data.error) {
        console.error('[Admin Page] Error from API:', data.error);
        setError(data.error);
        setAuthorized(false);
      } else {
        console.warn('[Admin Page] No shops or error in response:', data);
        setError('No shops found in response');
        setAuthorized(false);
      }
    } catch (err: any) {
      console.error('[Admin Page] Failed to fetch shops:', err);
      setError(err.message || 'Failed to load shops');
      setAuthorized(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
        credentials: 'include',
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setShowLogin(false);
        setPassword('');
        setAuthorized(true);
        fetchShops();
      } else {
        setLoginError(data.error || 'Invalid password');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
      });
      setAuthorized(false);
      setShops([]);
      setShowLogin(true);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const tableRows = shops.map((shop) => {
    const shopDisplayName = shop.shopName || shop.shopDomain.replace('.myshopify.com', '');
    const ownerDisplay = shop.ownerName 
      ? `${shop.ownerName}${shop.ownerEmail ? ` (${shop.ownerEmail})` : ''}`
      : shop.ownerEmail || 'N/A';
    
    const statusBadge = shop.isActive ? (
      <Badge tone="success">Active</Badge>
    ) : (
      <Badge tone="critical">Inactive</Badge>
    );

    const planBadge = shop.isPlus ? (
      <Badge tone="info">Plus</Badge>
    ) : (
      <Badge>Standard</Badge>
    );

    return [
      shopDisplayName,
      shop.shopDomain,
      ownerDisplay,
      statusBadge,
      planBadge,
      shop.locationSettingsCount?.toString() || '0',
      new Date(shop.createdAt).toLocaleDateString(),
    ];
  });

  const activeShops = shops.filter(s => s.isActive).length;
  const plusShops = shops.filter(s => s.isPlus).length;
  const totalLocations = shops.reduce((sum, shop) => sum + (shop.locationSettingsCount || 0), 0);

  // Show loading state
  if (loading && authorized === null && !showLogin) {
    return (
      <Page title="Admin Dashboard">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400" align="center">
                <Spinner size="large" />
                <Text as="p" tone="subdued">Loading admin dashboard...</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  // Show login modal if not authorized
  if (showLogin || authorized === false) {
    return (
      <Page title="Admin Login">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">
                  Admin Login
                </Text>
                <Text as="p" tone="subdued">
                  Enter the admin password to access the dashboard.
                </Text>
                <Divider />
                <BlockStack gap="400">
                  <TextField
                    label="Password"
                    type="password"
                    value={password}
                    onChange={setPassword}
                    autoComplete="current-password"
                    error={loginError || undefined}
                  />
                  {loginError && (
                    <Banner tone="critical">
                      <p>{loginError}</p>
                    </Banner>
                  )}
                  <Button
                    variant="primary"
                    onClick={handleLogin}
                    loading={loginLoading}
                  >
                    Login
                  </Button>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title="Admin Dashboard"
      primaryAction={{
        content: 'Refresh',
        onAction: fetchShops,
        loading,
      }}
      secondaryActions={[
        {
          content: 'Logout',
          onAction: handleLogout,
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          <Banner tone="info">
            <p>
              <strong>Admin View:</strong> This page shows all shops that have installed the Cloudship app. 
              Use this to monitor customer installations and track usage.
            </p>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingLg" as="h2">
                Overview Statistics
              </Text>
              <Divider />
              <InlineStack gap="800" align="start">
                <BlockStack gap="200">
                  <Text variant="headingMd" as="p" tone="subdued">
                    Total Shops
                  </Text>
                  <Text variant="heading2xl" as="p">
                    {shops.length}
                  </Text>
                </BlockStack>
                <BlockStack gap="200">
                  <Text variant="headingMd" as="p" tone="subdued">
                    Active Shops
                  </Text>
                  <Text variant="heading2xl" as="p" tone="success">
                    {activeShops}
                  </Text>
                </BlockStack>
                <BlockStack gap="200">
                  <Text variant="headingMd" as="p" tone="subdued">
                    Plus Shops
                  </Text>
                  <Text variant="heading2xl" as="p">
                    {plusShops}
                  </Text>
                </BlockStack>
                <BlockStack gap="200">
                  <Text variant="headingMd" as="p" tone="subdued">
                    Total Locations
                  </Text>
                  <Text variant="heading2xl" as="p">
                    {totalLocations}
                  </Text>
                </BlockStack>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                All Shops
              </Text>
              <Divider />
              {error && (
                <Banner tone="critical">
                  <p>{error}</p>
                </Banner>
              )}
              {loading ? (
                <Text as="p">Loading shops...</Text>
              ) : shops.length === 0 ? (
                <EmptyState
                  heading="No shops found"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>No shops have installed the app yet.</p>
                </EmptyState>
              ) : (
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text', 'numeric', 'text']}
                  headings={[
                    'Shop Name',
                    'Domain',
                    'Owner',
                    'Status',
                    'Plan',
                    'Locations',
                    'Installed',
                  ]}
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
