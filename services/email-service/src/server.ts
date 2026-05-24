import { Server } from "http";
import { initializeApp } from "./app.js";
import { env } from "#configs/env.js";
import { logger } from "#configs/logger.js";
import { initializeEmailTransporter } from "./configs/email.js";
import { messageBroker } from "./infrastructure/kafka/index.js";

class AppServer {
    private static instance: AppServer;
    private server?: Server;
    private isShutdown = false;
    private readonly timeout = 10000;

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
            logger.info("Initializing message broker");
            await messageBroker.connect();
            logger.info("Message topics create...");
            await messageBroker.createTopics();
            logger.info("Message topics created");
            logger.info("Starting application");

            await initializeEmailTransporter();
            logger.info("Email transporter initialized");
            // Subscribe to Kafka topic
            await messageBroker.subscribeToTopics();
            logger.info("Subscribed to Kafka topics");
            await messageBroker.startConsumer();
            const app = await initializeApp();
            logger.info("Application initialized");

            this.server = app.listen(env.PORT, () => {
                logger.info(
                    {
                        port: env.PORT,
                        pid: process.pid,
                    },
                    "HTTP server started",
                );
            });

            logger.info("Shutdown handlers registered");
        } catch (error: any) {
            logger.error(
                {
                    error: error?.message,
                    stack: error?.stack,
                },
                "Server startup failed",
            );

            process.exit(1);
        }
    }

    private setupProcessHandlers(): void {
        const exitSignals = [
            "SIGINT",
            "SIGTERM",
            "uncaughtException",
            "unhandledRejection",
        ] as const;

        exitSignals.forEach((signal) => {
            process.on(signal, (reason) => {
                if (
                    signal === "uncaughtException" ||
                    signal === "unhandledRejection"
                ) {
                    this.gracefulShutdown(signal, reason, 1);
                    return;
                }
                this.gracefulShutdown(signal, reason);
            });
        });
    }

    private async gracefulShutdown(
        signal: string,
        reason?: unknown,
        code = 0,
    ): Promise<void> {
        if (this.isShutdown) {
            logger.warn("Shutdown already in progress");
            return;
        }

        this.isShutdown = true;

        logger.warn(
            {
                signal,
            },
            "Graceful shutdown initiated",
        );

        if (
            reason &&
            (signal === "uncaughtException" || signal === "unhandledRejection")
        ) {
            logger.error(
                {
                    signal,
                    reason:
                        reason instanceof Error
                            ? reason.message
                            : String(reason),
                    stack: reason instanceof Error ? reason.stack : undefined,
                },
                "Unexpected process failure",
            );
        }

        const forceExit = setTimeout(() => {
            logger.error(
                {
                    timeout: this.timeout,
                },
                "Graceful shutdown timeout exceeded",
            );
            process.exit(1);
        }, this.timeout);

        try {
            await this.disconnectServer();

            clearTimeout(forceExit);

            logger.info("Application shutdown completed");
            process.exit(code);
        } catch (error: any) {
            logger.error(
                {
                    error: error?.message,
                    stack: error?.stack,
                },
                "Shutdown failed",
            );
            process.exit(1);
        }
    }

    private async disconnectServer(): Promise<void> {
        const server = this.server;
        await messageBroker.disconnect();
        if (!server) {
            logger.warn("HTTP server not initialized, skipping shutdown");
            return;
        }

        logger.info("Closing HTTP server");

        await new Promise<void>((resolve, reject) => {
            server.close((err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        logger.info("HTTP server closed");
    }
}

const server = AppServer.getInstance();
await server.start();
