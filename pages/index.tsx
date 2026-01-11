import { useEffect, useState, useRef } from 'react';
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
import { getSessionToken } from '@shopify/app-bridge/utilities';
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
  const isRedirecting = useRef(false);



  useEffect(() => {
    // Prevent double-invocation
    if (isRedirecting.current) return;

    const query = new URLSearchParams(window.location.search);
    const shop = query.get('shop') || '';
    const host = query.get('host') || '';

    // If no shop/host, we can't do anything (likely direct browser visit)
    if (!shop || !host) {
      setLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || '';
        const app = createApp({
          apiKey,
          host,
          forceRedirect: true,
        });

        // 1. Get Session Token (JWT)
        const token = await getSessionToken(app);

        // 2. Validate Session with Backend
        const res = await fetch(`/api/shop?shop=${encodeURIComponent(shop)}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.status === 401) {
          const data = await res.json();
          // ONLY redirect if backend explicitly requests re-auth
          // This prevents loops where 401 might be transient
          if (data.reauth) {
            console.log('[Home] Session valid but Shop not active. Triggering OAuth.');
            isRedirecting.current = true;

            const appOrigin = process.env.NEXT_PUBLIC_SHOPIFY_APP_URL || 'https://backend-cloud-jzom.onrender.com';
            const authUrl = `${appOrigin}/api/auth/begin?shop=${encodeURIComponent(shop)}`;

            const redirect = Redirect.create(app);
            redirect.dispatch(Redirect.Action.REMOTE, authUrl);
            return;
          }
        }

        if (res.ok) {
          const data = await res.json();
          if (data.shop) setShopInfo(data.shop);
        }

      } catch (e: any) {
        console.error("Auth check failed:", e);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []); // Run once


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
