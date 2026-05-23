import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

import { otpRepository } from "#modules/auth/otp.js";

const otpRepoPlugin: FastifyPluginAsync = fp(async (fastify) => {
    const repo = otpRepository(fastify.redis);

    fastify.decorate("otpRepo", repo);

    fastify.log.info(
        {
            event: "otp_repo_initialized",
        },
        "OTP repository initialized",
    );
});

export default otpRepoPlugin;
