import { registerNotFoundHandler } from "#plugins/not-found-handler.js";
import Fastify from "fastify";
import dbPlugin from "#plugins/db.js";
import authRepoPlugin from "#plugins/auth-repo.js";
import tokenServicePlugin from "#plugins/token-service.js";
import twoFactorServicePlugin from "#plugins/two-factor-service.js";
import authServicePlugin from "#plugins/auth-service.js";
import redisPlugin from "#plugins/redis.js";
import otpRepoPlugin from "#plugins/otp-repo.js";
import cookiePlugin from "#plugins/cookie.js";
import kafkaPlugin from "#plugins/kafka.js";
import { authRoutes } from "./modules/auth/route.js";
import authenticate from "./plugins/authenticate.js";
import {
    serializerCompiler,
    validatorCompiler,
    ZodTypeProvider,
} from "fastify-type-provider-zod";
import { registerErrorHandler } from "./plugins/error-handler.js";

export async function initializeApp() {
    const app = Fastify({
        logger: true,
        requestIdHeader: "X-Request-Id",
    });

    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    // ======================
    // Core infrastructure
    // ======================
    await app.register(dbPlugin);
    await app.register(cookiePlugin);
    await app.register(redisPlugin);
    await app.register(kafkaPlugin);
    // jwt / redis / config here too if used

    // ======================
    // Repositories
    // ======================
    await app.register(authRepoPlugin);
    await app.register(otpRepoPlugin);

    // ======================
    // Stateless services
    // ======================
    await app.register(tokenServicePlugin);
    await app.register(twoFactorServicePlugin);
    await app.register(authenticate);
    // ======================
    // Business services
    // ======================
    await app.register(authServicePlugin);

    // ======================
    // Global handlers
    // ======================
    await registerNotFoundHandler(app);
    await registerErrorHandler(app);

    // ======================
    // Routes
    // ======================
    await app.register(authRoutes, {
        prefix: "/api/v1/auth",
    });

    // ======================
    // Health
    // ======================
    app.get("/health", async () => ({
        status: "ok",
        service: "auth-service", // fix this
        timestamp: new Date().toISOString(),
    }));

    return app.withTypeProvider<ZodTypeProvider>();
}
