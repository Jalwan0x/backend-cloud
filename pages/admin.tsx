import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { verifyAuthCookie } from '@/lib/admin-auth';
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
  needsReauth?: boolean;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { req } = context;
  const isValid = verifyAuthCookie(req.cookies);

  if (!isValid) {
    return {
      redirect: {
        destination: '/admin/login',
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
};

export default function AdminPage() {
  const router = useRouter();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial fetch on mount (authorized is guaranteed by SSR)
  useEffect(() => {
    fetchShops();
  }, []);

  const fetchShops = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/shops');

      // 1. Client-Side Auth Failure (Session Expired)
      if (res.status === 401) {
        window.location.href = '/admin/login';
        return;
      }

      // 2. Server Error
      if (res.status === 500) {
        const data = await res.json();
        setError(`Server Error: ${data.details || data.error || 'Unknown error'}`);
        return;
      }

      // 3. Success
      if (res.ok) {
        const data = await res.json();
        setShops(data.shops || []);
      } else {
        setError('Failed to load shops');
      }

    } catch (err: any) {
      console.error('[Admin Page] Failed to fetch shops:', err);
      setError(err.message || 'Network failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      // Force hard redirect to clear client state
      window.location.href = '/admin/login';
    } catch (err) {
      console.error('Logout failed:', err);
      window.location.href = '/admin/login';
    }
  };

  const handleExportEmails = async () => {
    try {
      const res = await fetch('/api/admin/export-emails');
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cloudship_emails_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        alert('Failed to export emails');
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed');
    }
  };

  // --- Render Logic ---

  const tableRows = shops.map((shop) => {
    const shopDisplayName = shop.shopName || shop.shopDomain.replace('.myshopify.com', '');
    const ownerName = shop.ownerName || '-';
    const ownerEmail = shop.ownerEmail || 'Unknown';

    const statusBadge = shop.needsReauth ? (
      <Badge tone="critical">Reinstall Required</Badge>
    ) : shop.isActive ? (
      <Badge tone="success">Active</Badge>
    ) : (
      <Badge tone="attention">Inactive</Badge>
    );

    const planBadge = shop.isPlus ? (
      <Badge tone="info">Plus</Badge>
    ) : (
      <Badge>Standard</Badge>
    );

    return [
      shopDisplayName,
      shop.shopDomain,
      ownerName,
      ownerEmail,
      statusBadge,
      planBadge,
      shop.locationSettingsCount?.toString() || '0',
      new Date(shop.createdAt).toLocaleDateString(),
    ];
  });

  const activeShops = shops.filter(s => s.isActive).length;
  const plusShops = shops.filter(s => s.isPlus).length;
  const totalLocations = shops.reduce((sum, shop) => sum + (shop.locationSettingsCount || 0), 0);

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
          content: 'Export Emails (CSV)',
          onAction: handleExportEmails,
        },
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
              {error && (
                <Banner tone="critical">
                  <p>{error}</p>
                </Banner>
              )}
              {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}><Text as="p" tone="subdued">Loading shops...</Text></div>
              ) : shops.length === 0 ? (
                <EmptyState
                  heading="No shops found"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>No shops have installed the app yet.</p>
                </EmptyState>
              ) : (
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text', 'numeric', 'text']}
                  headings={['Shop Name', 'Domain', 'Owner Name', 'Email', 'Status', 'Plan', 'Locations', 'Installed']}
                  rows={tableRows}
                  footerContent={`Showing ${shops.length} shops`}
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
