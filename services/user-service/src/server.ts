import type { FastifyInstance } from 'fastify';

import { initializeApp } from './app.js';
import { env } from '#config/env.js';
import { logger } from '#config/logger.js';

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
                host: '0.0.0.0',
            });

            logger.info(`Server started on port ${env.PORT}`);
        } catch (error) {
            logger.error(error, 'Failed to start server');

            process.exit(1);
        }
    }

    private setupProcessHandlers(): void {
        process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));

        process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));

        process.on('uncaughtException', (error) =>
            this.gracefulShutdown('uncaughtException', error),
        );

        process.on('unhandledRejection', (reason) =>
            this.gracefulShutdown('unhandledRejection', reason),
        );
    }

    private async gracefulShutdown(
        signal: string,
        reason?: unknown,
    ): Promise<void> {
        if (this.isShutdown) {
            return;
        }

        this.isShutdown = true;

        logger.info(`${signal} received. Starting graceful shutdown...`);

        if (reason) {
            logger.error(reason);
        }

        const forceExit = setTimeout(() => {
            logger.error('Graceful shutdown timeout exceeded');

            process.exit(1);
        }, this.shutdownTimeout);

        try {
            if (this.app) {
                await this.app.close();
            }

            clearTimeout(forceExit);

            logger.info('Shutdown completed');

            process.exit(0);
        } catch (error) {
            logger.error(error, 'Shutdown failed');

            process.exit(1);
        }
    }
}

const server = AppServer.getInstance();

await server.start();
