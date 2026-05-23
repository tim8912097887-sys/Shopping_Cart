import fp from "fastify-plugin";
import { createClient, RedisClientType } from "redis";
import type { FastifyPluginAsync } from "fastify";

import { env } from "#config/env.js";

const redisPlugin: FastifyPluginAsync = fp(async (fastify) => {
    const redis: RedisClientType = createClient({
        url: env.REDIS_URL,
        socket: {
            reconnectStrategy(retries) {
                return Math.min(retries * 50, 2000);
            },
        },
    });

    redis.on("connect", () => {
        fastify.log.info(
            {
                event: "redis_connect",
            },
            "Redis connected",
        );
    });

    redis.on("ready", () => {
        fastify.log.info(
            {
                event: "redis_ready",
            },
            "Redis ready",
        );
    });

    redis.on("reconnecting", () => {
        fastify.log.warn(
            {
                event: "redis_reconnecting",
            },
            "Redis reconnecting",
        );
    });

    redis.on("end", () => {
        fastify.log.warn(
            {
                event: "redis_end",
            },
            "Redis connection closed",
        );
    });

    redis.on("error", (err) => {
        fastify.log.error(
            {
                err,
                event: "redis_error",
            },
            "Redis error",
        );
    });

    await redis.connect();

    fastify.decorate("redis", redis);

    fastify.addHook("onClose", async () => {
        await redis.quit();

        fastify.log.info(
            {
                event: "redis_shutdown",
            },
            "Redis connection closed",
        );
    });
});

export default redisPlugin;
