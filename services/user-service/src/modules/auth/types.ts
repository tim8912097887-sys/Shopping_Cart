import { authService } from "./service.js";
import { twoFactorService } from "./two-factor.js";

export interface AuthRepository {
    findByEmail(email: string): Promise<null>;
}

export type AccessPayload = {
    sub: string;
    sid: string;
    typ: "access" | "refresh";
};

export interface TokenService {
    signAccessToken(payload: AccessPayload): Promise<string>;
    verifyAccessToken(token: string): AccessPayload;
}

export type TwoFactorService = ReturnType<typeof twoFactorService>;

export type ReturnTypeAuthService = ReturnType<typeof authService>;
