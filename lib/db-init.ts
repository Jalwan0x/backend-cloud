import { prisma } from './db';

// Safety: prevent multiple migration runs in the same process
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Checks if the 'shops' table exists.
 * If not, creates the schema using raw SQL (no CLI needed).
 * This is safe to call repeatedly; it caches success.
 */
export async function ensureDatabaseReady() {
    // 1. Fast path: already checked in this process
    if (isInitialized) return;

    // 2. Concurrency safety: deduplicate requests
    if (initializationPromise) return initializationPromise;

    // 3. Start initialization
    initializationPromise = (async () => {
        try {
            console.log('[DB Init] Checking database state...');

            // Check if table exists (Postgres)
            const result: any[] = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE  table_schema = 'public'
          AND    table_name   = 'shops'
        );
      `;

            const exists = result[0]?.exists;

            if (exists) {
                console.log('[DB Init] Tables detected. Database is ready.');
                isInitialized = true;
                return;
            }

            console.warn('[DB Init] Table "shops" missing. Bootstrapping schema via raw SQL...');

            // RAW SQL MIGRATION (Matches prisma/schema.prisma)
            // Transaction ensures all or nothing
            await prisma.$transaction([
                // 1. Create shops table
                prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "shops" (
            "id" TEXT NOT NULL,
            "shopifyId" TEXT NOT NULL,
            "shopDomain" TEXT NOT NULL,
            "accessToken" TEXT NOT NULL,
            "scopes" TEXT NOT NULL,
            "isActive" BOOLEAN NOT NULL DEFAULT true,
            "isPlus" BOOLEAN NOT NULL DEFAULT false,
            "showBreakdown" BOOLEAN NOT NULL DEFAULT true,
            "sumRates" BOOLEAN NOT NULL DEFAULT true,
            "enableSplitShipping" BOOLEAN NOT NULL DEFAULT false,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
          );
        `),
                prisma.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS "shops_shopifyId_key" ON "shops"("shopifyId");
        `),
                prisma.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS "shops_shopDomain_key" ON "shops"("shopDomain");
        `),

                // 2. Create location_settings table
                prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "location_settings" (
            "id" TEXT NOT NULL,
            "shopId" TEXT NOT NULL,
            "shopifyLocationId" TEXT NOT NULL,
            "locationName" TEXT NOT NULL,
            "shippingCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "etaMin" INTEGER NOT NULL DEFAULT 1,
            "etaMax" INTEGER NOT NULL DEFAULT 2,
            "isActive" BOOLEAN NOT NULL DEFAULT true,
            "priority" INTEGER NOT NULL DEFAULT 0,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "location_settings_pkey" PRIMARY KEY ("id")
          );
        `),
                prisma.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS "location_settings_shopId_shopifyLocationId_key" ON "location_settings"("shopId", "shopifyLocationId");
        `),
                prisma.$executeRawUnsafe(`
          DO $$ BEGIN
            ALTER TABLE "location_settings" 
            ADD CONSTRAINT "location_settings_shopId_fkey" 
            FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          EXCEPTION
            WHEN duplicate_object THEN NULL;
          END $$;
        `),

                // 3. Create webhooks table
                prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "webhooks" (
            "id" TEXT NOT NULL,
            "shopId" TEXT NOT NULL,
            "topic" TEXT NOT NULL,
            "shopifyId" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
          );
        `),
                prisma.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS "webhooks_shopifyId_key" ON "webhooks"("shopifyId");
        `),
                prisma.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS "webhooks_shopId_topic_key" ON "webhooks"("shopId", "topic");
        `),
                prisma.$executeRawUnsafe(`
          DO $$ BEGIN
            ALTER TABLE "webhooks" 
            ADD CONSTRAINT "webhooks_shopId_fkey" 
            FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          EXCEPTION
            WHEN duplicate_object THEN NULL;
          END $$;
        `),
            ]);

            console.log('[DB Init] Schema bootstrap complete. Database is ready.');
            isInitialized = true;

        } catch (error: any) {
            console.error('[DB Init] CRITICAL: Bootstrap failed:', error);
            initializationPromise = null;
            throw new Error(`Database bootstrap failed: ${error.message}`);
        }
    })();

    return initializationPromise;
}
