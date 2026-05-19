import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '#config/env.js';
import { logger } from '#config/logger.js';
import { subscribeShutdown } from '#common/utils/shutdown.js';

class DatabaseServer {
    private static instance: DatabaseServer;
    public db: NodePgDatabase;
    private pool: Pool;
    constructor() {
        this.pool = new Pool({
            connectionString: env.DATABASE_URL,
            connectionTimeoutMillis: 5000,
            statement_timeout: 10000,
            query_timeout: 12000,
            max: 15,
            min: 2,
            idleTimeoutMillis: 5000,
        });
        this.db = drizzle(this.pool, {
            casing: 'snake_case',
        });
        this.setupEventListeners();
        // Subscribe to shutdown event
        // Bind this to the instance method to ensure correct context
        subscribeShutdown(this.dbDisconnection.bind(this));
    }

    public static getInstance() {
        if (!DatabaseServer.instance) {
            DatabaseServer.instance = new DatabaseServer();
        }
        return DatabaseServer.instance;
    }

    private setupEventListeners(): void {
        this.pool.on('connect', () => {
            logger.info({
                event: 'database_connected',
                service: 'user-service',
            });
        });
        this.pool.on('error', (error: any) => {
            logger.error({
                event: 'database_error',
                service: 'user-service',
                err: error,
            });
        });
    }

    //Handle Disconnection
    public async dbDisconnection() {
        await this.pool.end();
    }

    // Inside DatabaseServer class
    public async testConnection() {
        try {
            const client = await this.pool.connect();
            logger.info({
                event: 'database_test_connection_success',
                service: 'user-service',
            });
            client.release();
        } catch (error: any) {
            logger.error({
                event: 'database_test_connection_failed',
                service: 'user-service',
                err: error,
            });
            throw error; // Rethrow to stop the app if DB is down
        }
    }
}
const dbServer = DatabaseServer.getInstance();
const db = dbServer.db;
export { DatabaseServer, db, dbServer };
