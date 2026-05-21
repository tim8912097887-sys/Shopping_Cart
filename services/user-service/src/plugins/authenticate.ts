import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { errorResponse } from "#common/response/error.js";

export default fp(async function authenticatePlugin(app: FastifyInstance) {
    app.decorate("authenticate", async function (req, reply) {
        try {
            const authHeader = req.headers.authorization;

            if (!authHeader?.startsWith("Bearer ")) {
                return reply
                    .code(401)
                    .send(errorResponse("UNAUTHORIZED", "Missing token"));
            }

            const token = authHeader.slice(7);

            const payload = await app.tokenService.verifyAccessToken(token);

            // session lookup
            const sessions = await app.authRepo.findSessionById(payload.sid);

            const session = sessions[0];

            if (!session) {
                return reply
                    .code(401)
                    .send(errorResponse("UNAUTHORIZED", "Session not found"));
            }

            if (session.revokedAt) {
                return reply
                    .code(401)
                    .send(errorResponse("UNAUTHORIZED", "Session revoked"));
            }

            if (session.compromisedAt) {
                return reply
                    .code(401)
                    .send(errorResponse("UNAUTHORIZED", "Session compromised"));
            }

            if (session.expiresAt < new Date()) {
                return reply
                    .code(401)
                    .send(errorResponse("UNAUTHORIZED", "Session expired"));
            }

            req.user = {
                ...payload,
                sessionId: session.id,
            };
        } catch {
            return reply
                .code(401)
                .send(
                    errorResponse("UNAUTHORIZED", "Invalid or expired token"),
                );
        }
    });
});
