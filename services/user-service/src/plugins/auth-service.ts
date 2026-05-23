import fp from "fastify-plugin";
import { authService } from "../modules/auth/service.js";

export default fp(async function (app) {
    app.decorate(
        "authService",
        authService({
            repo: app.authRepo,
            tokenService: app.tokenService,
            twoFactorService: app.twoFactorService,
            logger: app.log,
            otpRepo: app.otpRepo,
            producer: app.producer,
        }),
    );
});
