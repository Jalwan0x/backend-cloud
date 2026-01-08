import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Page,
  Card,
  Layout,
  Text,
  BlockStack,
  Button,
  Banner,
  InlineStack,
  Badge,
  Divider,
} from '@shopify/polaris';

interface ShopInfo {
  shopDomain?: string;
  isPlus?: boolean;
  isActive?: boolean;
  locationSettingsCount?: number;
}

export default function Home() {
  const router = useRouter();
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const shop = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('shop') || ''
      : '';

    if (shop) {
      fetch(`/api/shop?shop=${encodeURIComponent(shop)}`)
        .then((res) => {
          if (res.status === 401 || res.status === 404) {
            console.log('[Home] Shop not authenticated/found. Redirecting to OAuth...');
            window.location.href = `/api/auth/begin?shop=${encodeURIComponent(shop)}`;
            return null; // Stop chain
          }
          return res.json();
        })
        .then((data) => {
          if (data && data.shop) {
            setShopInfo(data.shop);
          }
        })
        .catch((err) => {
          console.error('Failed to fetch shop info:', err);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const handleGoToLocations = () => {
    const shop = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('shop') || ''
      : '';
    if (shop) {
      router.push(`/locations?shop=${encodeURIComponent(shop)}`);
    } else {
      router.push('/locations');
    }
  };

  return (
    <Page
      title="Cloudship - Warehouse Shipping"
      primaryAction={{
        content: 'Configure Warehouses',
        onAction: handleGoToLocations,
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="500">
              <BlockStack gap="300">
                <Text variant="heading2xl" as="h1">
                  Welcome to Cloudship
                </Text>
                <Text variant="bodyLg" as="p" tone="subdued">
                  Per-warehouse shipping transparency for your Shopify store. Show customers exactly where their items ship from and when they&apos;ll arrive.
                </Text>
              </BlockStack>
              <Divider />
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  What Cloudship Does
                </Text>
                <BlockStack gap="300">
                  <InlineStack gap="300" align="start">
                    <Badge tone="success">✓</Badge>
                    <Text as="p">
                      <strong>Transparent Shipping:</strong> Customers see shipping costs and delivery times per warehouse location
                    </Text>
                  </InlineStack>
                  <InlineStack gap="300" align="start">
                    <Badge tone="success">✓</Badge>
                    <Text as="p">
                      <strong>Multi-Warehouse Support:</strong> Automatically groups cart items by warehouse location
                    </Text>
                  </InlineStack>
                  <InlineStack gap="300" align="start">
                    <Badge tone="success">✓</Badge>
                    <Text as="p">
                      <strong>Advanced/Plus Features:</strong> Enable split shipping options for Advanced and Plus stores
                    </Text>
                  </InlineStack>
                  <InlineStack gap="300" align="start">
                    <Badge tone="success">✓</Badge>
                    <Text as="p">
                      <strong>Easy Configuration:</strong> Set shipping costs and delivery times per location
                    </Text>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {shopInfo && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Your Store Status
                </Text>
                <Divider />
                <InlineStack gap="800" align="start">
                  <BlockStack gap="200">
                    <Text variant="bodyMd" as="p" tone="subdued">
                      Store Plan
                    </Text>
                    <Badge tone={shopInfo.isPlus ? 'info' : 'attention'}>
                      {shopInfo.isPlus ? 'Advanced/Plus' : 'Standard/Grow'}
                    </Badge>
                  </BlockStack>
                  <BlockStack gap="200">
                    <Text variant="bodyMd" as="p" tone="subdued">
                      Status
                    </Text>
                    <Badge tone={shopInfo.isActive ? 'success' : 'critical'}>
                      {shopInfo.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </BlockStack>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Get Started
              </Text>
              <Divider />
              <Text as="p" tone="subdued">
                Configure your warehouse locations and shipping settings to start providing transparent shipping information to your customers.
              </Text>
              <Button
                variant="primary"
                onClick={handleGoToLocations}
                size="large"
              >
                Configure Warehouse Settings
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>

        {shopInfo?.isPlus && (
          <Layout.Section>
            <Banner tone="info">
              <p>
                <strong>Advanced/Plus Plan Detected:</strong> You can enable split shipping options, allowing customers to choose individual shipping methods for items from different warehouses.
              </p>
            </Banner>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
