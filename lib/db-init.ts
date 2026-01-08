import { exec } from 'child_process';
import util from 'util';
import { prisma } from './db';

const execAsync = util.promisify(exec);

// Safety: prevent multiple migration runs in the same process
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Checks if the 'shops' table exists.
 * If not, runs 'npx prisma migrate deploy' to create the schema.
 * This is safe to call repeatedly; it caches success.
 */
export async function ensureDatabaseReady() {
    // 1. Fast path: already checked in this process
    if (isInitialized) {
        return;
    }

    // 2. Concurrency safety: deduplicate requests
    if (initializationPromise) {
        return initializationPromise;
    }

    // 3. Start initialization
    initializationPromise = (async () => {
        try {
            console.log('[DB Init] Checking database state...');

            // Check if table exists (Postgres specific)
            // We use a raw query that doesn't rely on the Prisma Client model being valid yet
            const result = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE  table_schema = 'public'
          AND    table_name   = 'shops'
        );
      `;

            const exists = (result as any[])[0]?.exists;

            if (exists) {
                console.log('[DB Init] Tables detected. Database is ready.');
                isInitialized = true;
                return;
            }

            console.warn('[DB Init] Table "shops" missing. Running migrations automatically...');

            // Run migration
            // Note: This requires 'npx' and 'prisma' to be available in the environment
            const { stdout, stderr } = await execAsync('npx prisma migrate deploy', {
                env: { ...process.env }, // Inherit env vars (DATABASE_URL)
            });

            console.log('[DB Init] Migration output:', stdout);
            if (stderr) console.warn('[DB Init] Migration stderr:', stderr);

            console.log('[DB Init] Migration complete. Database is now ready.');
            isInitialized = true;

        } catch (error: any) {
            console.error('[DB Init] CRITICAL: Initialization failed:', error);
            // Reset promise to allow retry on next request if transient failure
            initializationPromise = null;
            throw new Error(`Database initialization failed: ${error.message}`);
        }
    })();

    return initializationPromise;
}
