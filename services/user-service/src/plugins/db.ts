import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "#config/env.js";

const dbPlugin: FastifyPluginAsync = fp(async (fastify) => {
    const pool = new Pool({
        connectionString: env.DATABASE_URL,
        connectionTimeoutMillis: 5000,
        statement_timeout: 10000,
        query_timeout: 12000,
        max: 15,
        min: 2,
        idleTimeoutMillis: 5000,
    });

    pool.on("connect", () => {
        fastify.log.info(
            {
                event: "database_connected",
                service: "user-service",
            },
            "Postgres connection created",
        );
    });

    pool.on("error", (err) => {
        fastify.log.error(
            {
                err,
                event: "database_error",
                service: "user-service",
            },
            "Postgres pool error",
        );
    });

    // Fail fast during boot
    try {
        const client = await pool.connect();

        fastify.log.info(
            {
                event: "database_test_connection_success",
                service: "user-service",
            },
            "Database connection verified",
        );

        client.release();
    } catch (err) {
        fastify.log.fatal(
            {
                err,
                event: "database_test_connection_failed",
                service: "user-service",
            },
            "Database startup connection failed",
        );

        await pool.end();
        throw err;
    }

    const db: NodePgDatabase = drizzle(pool, {
        casing: "snake_case",
    });

    // decorate app
    fastify.decorate("pgPool", pool);
    fastify.decorate("db", db);

    // graceful shutdown
    fastify.addHook("onClose", async () => {
        await pool.end();

        fastify.log.info(
            {
                event: "database_shutdown",
                service: "user-service",
            },
            "Database pool closed",
        );
    });
});

export default dbPlugin;
