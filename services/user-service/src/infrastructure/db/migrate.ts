import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { env } from '#config/env.js';
import { logger } from '#config/logger.js';

const pool = new Pool({
    connectionString: env.DATABASE_URL,
});

const db = drizzle(pool);

async function main() {
    const start = Date.now();

    logger.info({
        event: 'migration_started',
        service: 'auth-service',
    });

    try {
        await migrate(db, {
            migrationsFolder: './drizzle',
        });

        const duration = Date.now() - start;

        logger.info({
            event: 'migration_completed',
            service: 'auth-service',
            durationMs: duration,
        });

        await pool.end();

        logger.info({
            event: 'migration_db_closed',
        });

        process.exit(0);
    } catch (err) {
        const duration = Date.now() - start;

        logger.error({
            event: 'migration_failed',
            service: 'auth-service',
            durationMs: duration,
            err, // structured error
        });

        await pool.end().catch(() => {});

        process.exit(1);
    }
}

main();
