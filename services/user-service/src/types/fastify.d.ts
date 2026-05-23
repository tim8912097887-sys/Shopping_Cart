import "fastify";
import { AuthService } from "#modules/auth/types.js";
import { tokenService } from "#modules/auth/token.js";
import { twoFactorService } from "#modules/auth/two-factor.js";
import { authRepository } from "#modules/auth/repository.js";
import { RedisClientType } from "redis";
import { OtpRepository } from "#modules/auth/otp.js";
import { MessageBrokerType } from "@shoppingcart/message-broker";

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
        redis: RedisClientType;
        otpRepo: ReturnType<typeof OtpRepository>;
        kafka: MessageBrokerType;
        producer: MessageBrokerType["producer"];
    }

    interface FastifyRequest {
        user: {
            sub: string;
            sid: string;
        };
    }
}
