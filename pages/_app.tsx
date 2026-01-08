import type { AppProps } from 'next/app';
import { AppProvider } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
import { Provider } from '@shopify/app-bridge-react';
import translations from '@shopify/polaris/locales/en.json';
import { useRouter } from 'next/router';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isAdminPage = router.pathname === '/admin';
  
  // Only use App Bridge for embedded Shopify app pages, not for admin page
  const host = typeof window !== 'undefined' 
    ? new URLSearchParams(window.location.search).get('host') || '' 
    : '';
  
  const hasHost = host && host.length > 0;
  const shouldUseAppBridge = !isAdminPage && hasHost;

  const config = {
    apiKey: process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || '',
    host: host,
    forceRedirect: true,
  };

  // For admin page or when host is missing, skip App Bridge
  if (isAdminPage || !shouldUseAppBridge) {
    return (
      <AppProvider i18n={translations}>
        <Component {...pageProps} />
      </AppProvider>
    );
  }

  // For regular Shopify app pages, use App Bridge
  return (
    <Provider config={config}>
      <AppProvider i18n={translations}>
        <Component {...pageProps} />
      </AppProvider>
    </Provider>
  );
}
