import type { RegisterUserType } from "./schema.js";

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

export interface SessionTokens {
    accessToken: string;
    refreshToken: string;
    sessionId: string;
}

export interface RefreshTokensResult {
    accessToken: string;
    refreshToken: string;
}

export interface TwoFactorSetupResult {
    secret: string;
    otpAuthUrl: string;
    qrcode: string;
}

export type LoginResult = SessionTokens | { requires2FA: true; userId: string };

export interface AuthService {
    signup(
        input: RegisterUserType,
    ): Promise<{ id: string; email: string } | undefined>;

    login(input: {
        email: string;
        password: string;
        userAgent: string | undefined;
        ip: string | undefined;
    }): Promise<LoginResult>;

    verify2FA(input: {
        userId: string;
        code: string;
        userAgent: string | undefined;
        ip: string | undefined;
    }): Promise<SessionTokens>;

    refresh(refreshToken: string): Promise<RefreshTokensResult>;

    logout(sessionId: string): Promise<void>;

    logoutAll(userId: string): Promise<void>;

    setup2FA(userId: string): Promise<TwoFactorSetupResult>;

    confirm2FA(input: {
        userId: string;
        code: string;
    }): Promise<{ enabled: true }>;

    disable2FA(userId: string): Promise<{ disabled: true }>;
    verifyAccount(verifyInfo: {
        code: string;
        email: string;
    }): Promise<{ verified: true }>;
}

export type TotpSecret = string;

export interface GenerateOtpAuthUrlInput {
    email: string;
    secret: TotpSecret;
    issuer: string;
}

export interface TwoFactorService {
    generateSecret(): TotpSecret;

    generateOtpAuthUrl(input: GenerateOtpAuthUrlInput): string;

    generateCode(secret: TotpSecret): string;

    verifyTotp(secret: TotpSecret, code: string): boolean;
}

export type OtpType = "email_verification";

export type CreateOtpInfo = {
    userId: string;
    code: string;
    otpType: OtpType;
};

export type GetOtpInfo = {
    userId: string;
    otpType: OtpType;
};

export type OtpRepository = {
    createOtp(createOtpInfo: CreateOtpInfo): Promise<string>;
    getOtp(
        getOtpInfo: GetOtpInfo,
    ): Promise<{ code: string; attempt: number; createdAt: string } | null>;
    incrementOtpAttempt(getOtpInfo: GetOtpInfo): Promise<number>;
    deleteOtp(getOtpInfo: GetOtpInfo): Promise<number>;
    getCooldownTtl(getOtpInfo: GetOtpInfo): Promise<number>;
    otpExists(getOtpInfo: GetOtpInfo): Promise<number>;
};
