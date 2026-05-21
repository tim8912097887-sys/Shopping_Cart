import { SignJWT, jwtVerify, importPKCS8, importSPKI } from "jose";
import { AccessPayload } from "./types.js";
import { env } from "#config/env.js";

export async function tokenService() {
    const alg = "EdDSA";

    const privateKey = await importPKCS8(env.ACCESS_PRIVATE_KEY, alg);

    const publicKey = await importSPKI(env.ACCESS_PUBLIC_KEY, alg);

    async function signAccessToken(payload: AccessPayload) {
        return new SignJWT(payload)
            .setProtectedHeader({
                alg,
                typ: "JWT",
                kid: "access-v1",
            })
            .setIssuer(env.JWT_ISSUER)
            .setAudience(env.JWT_AUDIENCE)
            .setIssuedAt()
            .setExpirationTime("15m")
            .setJti(crypto.randomUUID())
            .sign(privateKey);
    }

    async function verifyAccessToken(token: string) {
        const { payload } = await jwtVerify(token, publicKey, {
            issuer: env.JWT_ISSUER,
            audience: env.JWT_AUDIENCE,
            algorithms: [alg],
        });

        if (payload.typ !== "access") {
            throw new Error("Invalid token type");
        }

        return payload as AccessPayload;
    }

    return {
        signAccessToken,
        verifyAccessToken,
    };
}
