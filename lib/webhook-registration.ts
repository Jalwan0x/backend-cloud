import { getShopifySession } from './shopify';
import { shopify } from './shopify';
import { prisma } from './db';

const WEBHOOK_TOPICS = [
  'app/uninstalled',
  'shop/update',
  'app_subscriptions/update',
];

export async function registerWebhooks(shopDomain: string): Promise<void> {
  // 1. Setup Session & Client
  const session = await getShopifySession(shopDomain);
  if (!session) {
    throw new Error('Shop session not found');
  }

  const client = new shopify.clients.Graphql({ session });
  const appUrl = process.env.SHOPIFY_APP_URL || '';

  const shopRecord = await prisma.shop.findUnique({
    where: { shopDomain },
  });

  if (!shopRecord) {
    throw new Error('Shop record not found');
  }

  // 2. Fetch Existing Webhooks
  const existingWebhooksQuery = `
    query {
      webhookSubscriptions(first: 20) {
        edges {
          node {
            id
            topic
            endpoint {
              ... on WebhookHttpEndpoint {
                callbackUrl
              }
            }
          }
        }
      }
    }
  `;

  let existingSubscriptions: any[] = [];
  try {
    const response = await client.query({ data: { query: existingWebhooksQuery } });
    const body: any = response.body;
    existingSubscriptions = body.data?.webhookSubscriptions?.edges?.map((edge: any) => edge.node) || [];
  } catch (error) {
    console.error('Failed to fetch existing webhooks:', error);
  }

  // 3. Process Each Topic
  for (const topic of WEBHOOK_TOPICS) {
    let expectedUrl = '';
    if (topic === 'app/uninstalled') {
      expectedUrl = `${appUrl}/api/webhooks/app/uninstalled`;
    } else if (topic === 'shop/update') {
      expectedUrl = `${appUrl}/api/webhooks/shop/update`;
    } else if (topic === 'app_subscriptions/update') {
      expectedUrl = `${appUrl}/api/webhooks/app/subscription_update`;
    }

    const topicEnum = topic.toUpperCase().replace(/\//g, '_');

    // Check for existing valid webhook
    const validExists = existingSubscriptions.some(
      (sub: any) => sub.topic === topicEnum && sub.endpoint?.callbackUrl === expectedUrl
    );

    // Find stale webhooks
    const staleWebhooks = existingSubscriptions.filter(
      (sub: any) => sub.topic === topicEnum && sub.endpoint?.callbackUrl !== expectedUrl
    );

    // DELETE Stale
    for (const stale of staleWebhooks) {
      console.log(`Deleting stale webhook: ${stale.id}`);
      const deleteMutation = `
        mutation webhookSubscriptionDelete($id: ID!) {
          webhookSubscriptionDelete(id: $id) {
            deletedWebhookSubscriptionId
            userErrors {
              field
              message
            }
          }
        }
      `;
      try {
        await client.query({
          data: {
            query: deleteMutation,
            variables: { id: stale.id },
          },
        });
        await prisma.webhook.deleteMany({ where: { shopifyId: stale.id } });
      } catch (err) {
        console.error(`Failed to delete stale webhook ${stale.id}:`, err);
      }
    }

    // REGISTER New
    if (!validExists) {
      console.log(`Registering webhook: ${topic}`);
      try {
        const mutation = `
          mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
            webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
              webhookSubscription {
                id
                callbackUrl
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        const response = await client.query({
          data: {
            query: mutation,
            variables: {
              topic: topicEnum,
              webhookSubscription: {
                callbackUrl: expectedUrl,
                format: 'JSON',
              },
            },
          },
        });

        const data = response.body as any;
        const webhook = data.data?.webhookSubscriptionCreate?.webhookSubscription;

        if (webhook && !data.data?.webhookSubscriptionCreate?.userErrors?.length) {
          const shopId_topic = { shopId: shopRecord.id, topic };
          const webhookData = {
            shopId: shopRecord.id,
            topic,
            shopifyId: webhook.id,
          };

          await prisma.webhook.upsert({
            where: { shopId_topic },
            create: webhookData,
            update: webhookData,
          });
          console.log(`Registered ${topic} webhook successfully.`);
        } else {
          console.error(`Error registering ${topic}:`, JSON.stringify(data.data?.webhookSubscriptionCreate?.userErrors));
        }
      } catch (error) {
        console.error(`Failed to register webhook ${topic}:`, error);
      }
    } else {
      console.log(`Webhook ${topic} is already registered.`);
    }
  }
}
