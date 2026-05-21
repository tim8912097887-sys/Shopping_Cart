import "fastify";
import { AuthService } from "#modules/auth/types.js";
import { authRepository } from "#modules/auth/repository.js";
import { tokenService } from "#modules/auth/token.js";
import { twoFactorService } from "#modules/auth/two-factor.js";

declare module "fastify" {
    interface FastifyInstance {
        authService: AuthService;
        db: PostgresJsDatabase<typeof schema>;
        authRepo: ReturnType<typeof authRepository>;
        tokenService: ReturnType<typeof Promise<tokenService>>;
        twoFactorService: ReturnType<typeof twoFactorService>;
        authenticate: (
            req: FastifyRequest,
            reply: FastifyReply,
        ) => Promise<void>;
    }

    interface FastifyRequest {
        user: {
            sub: string;
            sid: string;
        };
    }
}
