import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Page,
  Card,
  Layout,
  Text,
  BlockStack,
  Button,
  Divider,
} from '@shopify/polaris';
// IMPORTING VANILLA App Bridge utilities (No hooks)
// This avoids "Conditional Hook" errors since we only use these inside useEffect/callbacks
import { createApp } from '@shopify/app-bridge';
import { Redirect } from '@shopify/app-bridge/actions';

interface ShopInfo {
  shopDomain?: string;
  isPlus?: boolean;
  isActive?: boolean;

}

export default function Home() {
  const router = useRouter();
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Get Params
    const query = new URLSearchParams(window.location.search);
    const shop = query.get('shop') || '';
    const host = query.get('host') || '';

    // 2. Check Auth Status
    if (shop) {
      fetch(`/api/shop?shop=${encodeURIComponent(shop)}`)
        .then((res) => {
          if (res.status === 401 || res.status === 404) {
            console.log('[Home] Shop not authenticated/found. Initiating OAuth...');
            const authUrl = `/api/auth/begin?shop=${encodeURIComponent(shop)}`;

            // 3. HANDLE EMBEDDED OAUTH (Firefox Fix)
            // If we have a 'host' param, we assume we are embedded.
            if (host) {
              console.log('[Home] Detected Embedded App (Host Present). Using App Bridge Remote Redirect.');
              try {
                // Initialize Vanilla App Bridge (Safe inside effect)
                const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || ''; // Ensure this is exposed
                const app = createApp({
                  apiKey: apiKey,
                  host: host,
                  forceRedirect: true,
                });

                const redirect = Redirect.create(app);
                redirect.dispatch(Redirect.Action.REMOTE, authUrl);
              } catch (e) {
                console.warn('[Home] Failed to init App Bridge for redirect. Fallback to window.', e);
                window.location.href = authUrl;
              }
            } else {
              // Fallback / Not Embedded
              console.log('[Home] Not embedded (No Host). Using window.location.');
              window.top!.location.href = authUrl;
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
  }, []); // Run once on mount

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
              {/* Simplified content for clarity, functionality remains */}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
