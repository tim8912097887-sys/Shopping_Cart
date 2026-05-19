import { registerNotFoundHandler } from '#plugins/not-found-handler.js';
import Fastify from 'fastify';

export async function initializeApp() {
    const app = Fastify({
        logger: true,
    });

    // Health check
    app.get('/health', async () => {
        return {
            status: 'ok',
            service: 'user-service',
            timestamp: new Date().toISOString(),
        };
    });

    // Register not found handler
    await registerNotFoundHandler(app);

    return app;
}
