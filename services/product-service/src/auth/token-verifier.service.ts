import {
    Injectable,
    OnModuleInit,
    UnauthorizedException,
} from "@nestjs/common";
import { jwtVerify, importSPKI, JWTPayload } from "jose";
import { env } from "#configs/env.js";

@Injectable()
export class TokenVerifierService implements OnModuleInit {
    private publicKey!: CryptoKey;
    private algorithms = ["EdDSA"];

    async onModuleInit() {
        this.publicKey = await importSPKI(env.ACCESS_PUBLIC_KEY, "EdDSA");
    }

    async verifyAccessToken(token: string): Promise<JWTPayload> {
        try {
            const { payload } = await jwtVerify(token, this.publicKey, {
                issuer: env.JWT_ISSUER,
                audience: env.JWT_AUDIENCE,
                algorithms: this.algorithms,
            });

            return payload;
        } catch {
            throw new UnauthorizedException("Invalid access token");
        }
    }
}
