import type { FastifyInstance } from "fastify";

import { initializeApp } from "./app.js";
import { env } from "#config/env.js";
import { logger } from "#config/logger.js";

class AppServer {
    private static instance: AppServer;

    private app?: FastifyInstance;

    private isShutdown = false;

    private readonly shutdownTimeout = 10000;

    private constructor() {
        this.setupProcessHandlers();
    }

    public static getInstance(): AppServer {
        if (!AppServer.instance) {
            AppServer.instance = new AppServer();
        }

        return AppServer.instance;
    }

    public async start(): Promise<void> {
        try {
            this.app = await initializeApp();
            await this.app.listen({
                port: env.PORT,
                host: "0.0.0.0",
            });

            logger.info({
                event: "server_started",
                service: "user-service",
                port: env.PORT,
            });
        } catch (error) {
            logger.error({
                event: "server_start_failed",
                service: "user-service",
                err: error,
            });

            process.exit(1);
        }
    }

    private setupProcessHandlers(): void {
        process.on("SIGINT", () => this.gracefulShutdown("SIGINT"));

        process.on("SIGTERM", () => this.gracefulShutdown("SIGTERM"));

        process.on("uncaughtException", (error) =>
            this.gracefulShutdown("uncaughtException", error, 1),
        );

        process.on("unhandledRejection", (reason) =>
            this.gracefulShutdown("unhandledRejection", reason, 1),
        );
    }

    private async gracefulShutdown(
        signal: string,
        reason?: unknown,
        code = 0,
    ): Promise<void> {
        if (this.isShutdown) {
            return;
        }

        this.isShutdown = true;

        logger.info({
            event: "shutdown_initiated",
            service: "user-service",
            signal,
        });

        if (reason) {
            logger.error({
                event: "shutdown_reason",
                service: "user-service",
                reason,
            });
        }

        const forceExit = setTimeout(() => {
            logger.error({
                event: "shutdown_timeout_exceeded",
                service: "user-service",
                timeoutMs: this.shutdownTimeout,
            });

            process.exit(1);
        }, this.shutdownTimeout);

        try {
            if (this.app) {
                await this.app.close();
            }

            clearTimeout(forceExit);

            logger.info({
                event: "shutdown_completed",
                service: "user-service",
            });

            process.exit(code);
        } catch (error) {
            logger.error({
                event: "shutdown_failed",
                service: "user-service",
                err: error,
            });

            process.exit(1);
        }
    }
}

const server = AppServer.getInstance();

await server.start();
