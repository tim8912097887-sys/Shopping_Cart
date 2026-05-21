import type { FastifyInstance } from "fastify";

import { authController } from "./controller.js";
import {
    confirm2FASchema,
    Confirm2FAType,
    LoginUserSchema,
    RegisterUserSchema,
    verify2FASchema,
} from "./schema.js";

export async function authRoutes(app: FastifyInstance) {
    const controller = authController({
        service: app.authService,
    });

    app.post(
        "/signup",
        {
            schema: {
                body: RegisterUserSchema,
            },
        },
        controller.signup,
    );
    app.post("/login", { schema: { body: LoginUserSchema } }, controller.login);

    app.post(
        "/2fa/setup",
        {
            preHandler: [app.authenticate],
        },
        controller.setup2FA,
    );

    app.post<{ Body: Confirm2FAType }>(
        "/2fa/confirm",
        {
            preHandler: [app.authenticate],
            schema: {
                body: confirm2FASchema,
            },
        },
        controller.confirm2FA,
    );

    app.post(
        "/2fa/verify",
        {
            schema: {
                body: verify2FASchema,
            },
        },
        controller.verify2FA,
    );

    app.post(
        "/2fa/disable",
        {
            preHandler: [app.authenticate],
        },
        controller.disable2FA,
    );

    app.post("/refresh", controller.refresh);

    app.post(
        "/logout",
        {
            preHandler: [app.authenticate],
        },
        controller.logout,
    );

    app.post(
        "/logout-all",
        {
            preHandler: [app.authenticate],
        },
        controller.logoutAll,
    );
}
