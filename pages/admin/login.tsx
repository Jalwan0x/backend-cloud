import { useState } from 'react';
import { useRouter } from 'next/router';
import {
    Page,
    Layout,
    Card,
    FormLayout,
    TextField,
    Button,
    BlockStack,
    Text,
    Banner,
} from '@shopify/polaris';

export default function AdminLogin() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
                credentials: 'include',
            });

            const data = await res.json();

            if (res.ok && data.success) {
                // Redirect to admin dashboard on success
                router.push('/admin');
            } else {
                setError(data.error || 'Invalid password');
            }
        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Page title="CloudShip Admin">
            <Layout>
                <Layout.Section>
                    <div style={{ maxWidth: '400px', margin: '0 auto', paddingTop: '4rem' }}>
                        <Card>
                            <BlockStack gap="400">
                                <Text variant="headingLg" as="h2">
                                    Admin Login
                                </Text>

                                {error && (
                                    <Banner tone="critical">
                                        <p>{error}</p>
                                    </Banner>
                                )}

                                <FormLayout>
                                    <TextField
                                        label="Password"
                                        type="password"
                                        value={password}
                                        onChange={setPassword}
                                        autoComplete="current-password"
                                    />
                                    <Button
                                        variant="primary"
                                        onClick={handleLogin}
                                        loading={loading}
                                        fullWidth
                                    >
                                        Login
                                    </Button>
                                </FormLayout>
                            </BlockStack>
                        </Card>
                    </div>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
