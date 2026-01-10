import { shopify, billingConfig } from './shopify';
import { prisma } from './db';
import { Session } from '@shopify/shopify-api';

const PLAN_NAME = Object.keys(billingConfig)[0]; // "Pro Plan" (from env)

export interface BillingCheckResult {
    hasActiveSubscription: boolean;
    confirmationUrl?: string;
    isTrial?: boolean;
}

export async function ensureBilling(
    session: Session,
    shopDomain: string
): Promise<BillingCheckResult> {
    if (!session) {
        throw new Error('No session provided for billing check');
    }

    try {
        // 1. Check if user has active subscription
        const hasPayment = await shopify.billing.check({
            session,
            plans: [PLAN_NAME],
            isTest: process.env.NODE_ENV === 'development',
        });

        // 2. Determine Status
        let status = 'expired';
        if (hasPayment) {
            // Technically 'check' returns true if ANY of the plans are active.
            // We assume 'active' for now. Detailed status would require a full query, 
            // but 'check' is sufficient for enforcement.
            status = 'active';
        }

        // 3. Update DB (Asynchronous - don't block heavily)
        await prisma.shop.update({
            where: { shopDomain },
            data: {
                subscriptionStatus: status,
                planName: hasPayment ? PLAN_NAME : null
            },
        });

        if (hasPayment) {
            return { hasActiveSubscription: true };
        }

        // 4. If no payment, generate request URL
        const confirmationUrl = await shopify.billing.request({
            session,
            plan: PLAN_NAME,
            isTest: process.env.NODE_ENV === 'development',
            returnUrl: `https://${shopify.config.hostName}/api/auth/billing-callback?shop=${shopDomain}`,
        });

        return {
            hasActiveSubscription: false,
            confirmationUrl
        };

    } catch (error) {
        console.error('Billing check failed:', error);
        // Fail safe to BLOCK access if unsure
        return { hasActiveSubscription: false };
    }
}
