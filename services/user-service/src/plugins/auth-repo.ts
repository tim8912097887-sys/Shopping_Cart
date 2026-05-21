import fp from "fastify-plugin";
import { authRepository } from "../modules/auth/repository.js";

export default fp(async function (app) {
    app.decorate("authRepo", authRepository(app.db));
});
