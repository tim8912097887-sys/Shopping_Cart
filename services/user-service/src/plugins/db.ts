import fp from "fastify-plugin";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "#config/env.js";

export default fp(
    async function dbPlugin(app) {
        const client = new Pool({
            connectionString: env.DATABASE_URL,
        });

        const db = drizzle(client);

        app.decorate("db", db);

        app.addHook("onClose", async () => {
            await client.end();
        });
    },
    {
        name: "db",
    },
);
