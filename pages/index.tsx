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
import { useAppBridge } from '@shopify/app-bridge-react';
import { Redirect } from '@shopify/app-bridge/actions';

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

  // Try to get app bridge instance (might be null if not embedded)
  const app = typeof window !== 'undefined' ? (window as any).shopify : null;
  // Note: We use useAppBridge hook safely
  let appBridge = null;
  try {
    appBridge = useAppBridge();
  } catch (e) {
    // Not inside AppBridge context
  }

  useEffect(() => {
    const shop = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('shop') || ''
      : '';

    if (shop) {
      fetch(`/api/shop?shop=${encodeURIComponent(shop)}`)
        .then((res) => {
          if (res.status === 401 || res.status === 404) {
            console.log('[Home] Shop not authenticated/found. Initiating OAuth...');
            const authUrl = `/api/auth/begin?shop=${encodeURIComponent(shop)}`;

            // CRITICAL: Handle Embedded App Redirect (Firefox Fix)
            if (appBridge) {
              console.log('[Home] Detected Embedded App. Using App Bridge Redirect.');
              const redirect = Redirect.create(appBridge);
              redirect.dispatch(Redirect.Action.REMOTE, authUrl);
            } else {
              // Fallback for non-embedded (or if App Bridge fails to init)
              console.log('[Home] Not embedded. Using window.location.');
              window.location.href = authUrl;
            }
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
  }, [appBridge]);

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
              {/* Content truncated for brevity, identical to previous version */}
            </BlockStack>
          </Card>
        </Layout.Section>
        {/* Sections for Status and Get Started identical to previous version */}
      </Layout>
    </Page>
  );
}
