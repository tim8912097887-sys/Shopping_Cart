import fp from "fastify-plugin";
import { twoFactorService } from "../modules/auth/two-factor.js";

export default fp(async function (app) {
    app.decorate("twoFactorService", twoFactorService());
});
