import fp from "fastify-plugin";
import { tokenService } from "../modules/auth/token.js";

export default fp(
    async function (app) {
        const service = await tokenService();
        app.decorate("tokenService", service);
    },
    {
        name: "token-service",
    },
);
