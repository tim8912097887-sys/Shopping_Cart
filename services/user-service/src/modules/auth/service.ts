import {
    comparePassword,
    compareRefreshToken,
    generateQrCode,
    generateRefreshToken,
    hashPassword,
    hashRefreshToken,
} from "./util.js";
import type { AuthRepository } from "./repository.js";
import { TokenService, TwoFactorService } from "./types.js";
import {
    AccountLockedError,
    InvalidCredentialsError,
    InvalidRefreshTokenError,
    InvalidTwoFactorCodeError,
    RefreshTokenExpiredError,
    RefreshTokenReuseDetectedError,
    RefreshTokenRevokedError,
    TwoFactorNotEnabledError,
} from "./error.js";
import { RegisterUserType } from "./schema.js";

export function authService(deps: {
    repo: AuthRepository;
    tokenService: TokenService;
    twoFactorService: TwoFactorService;
    logger: any;
}) {
    const { repo, tokenService, twoFactorService, logger } = deps;

    // =================================
    // SIGNUP
    // =================================
    async function signup(input: RegisterUserType) {
        const existing = await repo.findUserByEmail(input.email);

        if (existing.length > 0) {
            return;
        }

        const passwordHash = await hashPassword(input.password, 12);

        const user = await repo.createUser({
            email: input.email,
            passwordHash,
        });

        return {
            id: user.id,
            email: user.email,
        };
    }

    // =================================
    // LOGIN
    // =================================
    async function login(input: {
        email: string;
        password: string;
        userAgent: string | undefined;
        ip: string | undefined;
    }) {
        const users = await repo.findUserByEmail(input.email);
        const user = users[0];

        if (!user) {
            throw new InvalidCredentialsError(input.email);
        }

        if (user.loginLockUntil && new Date(user.loginLockUntil) > new Date()) {
            logger.warn(
                {
                    userId: user.id,
                    email: input.email,
                    lockedUntil: user.loginLockUntil,
                },
                "Login blocked: account locked",
            );

            throw new AccountLockedError(user.id, user.loginLockUntil);
        }

        const valid = await comparePassword(input.password, user.password);

        if (!valid) {
            await repo.incrementFailedLoginAttempts(user.id);

            const attempts = (user.failLoginAttempts ?? 0) + 1;

            logger.warn(
                {
                    userId: user.id,
                    email: input.email,
                    attempts,
                },
                "Invalid login credentials",
            );
            if (attempts >= 5) {
                const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
                await repo.lockLogin(user.id, lockUntil);
                logger.error(
                    {
                        userId: user.id,
                        email: input.email,
                        lockUntil,
                    },
                    "Account locked due to repeated failed login attempts",
                );
            }

            throw new InvalidCredentialsError(input.email);
        }

        await repo.resetLoginAttempts(user.id);
        await repo.updateLastLogin(user.id);

        logger.info(
            {
                userId: user.id,
            },
            "Login successful",
        );

        if (user.twoFactorEnabled) {
            logger.info(
                {
                    userId: user.id,
                },
                "2FA required for login",
            );
            return {
                requires2FA: true,
                userId: user.id,
            } as const;
        }

        return issueSession({
            userId: user.id,
            userAgent: input.userAgent,
            ip: input.ip,
        });
    }

    // =================================
    // Setup 2FA
    // =================================
    async function setup2FA(userId: string) {
        const users = await repo.findUserById(userId);
        const user = users[0];

        if (!user) {
            throw new InvalidCredentialsError();
        }

        const secret = twoFactorService.generateSecret();

        const otpAuthUrl = twoFactorService.generateOtpAuthUrl({
            email: user.email,
            secret,
            issuer: "shopping-cart",
        });

        const qrcode = await generateQrCode(otpAuthUrl);

        await repo.saveTwoFactorSecret(userId, secret);

        logger.info(
            {
                userId,
            },
            "2FA setup initialized",
        );

        return {
            secret,
            otpAuthUrl,
            qrcode,
        };
    }

    // =================================
    // Confirm 2FA
    // =================================
    async function confirm2FA(input: { userId: string; code: string }) {
        const users = await repo.findUserById(input.userId);
        const user = users[0];

        if (!user || !user.twoFactorSecret) {
            throw new TwoFactorNotEnabledError(input.userId);
        }

        const valid = twoFactorService.verifyTotp(
            user.twoFactorSecret,
            input.code,
        );

        if (!valid) {
            logger.warn(
                {
                    userId: input.userId,
                },
                "Invalid 2FA confirmation code",
            );

            throw new InvalidTwoFactorCodeError(input.userId);
        }

        await repo.enableTwoFactor(input.userId);

        logger.info(
            {
                userId: input.userId,
            },
            "2FA enabled successfully",
        );

        return {
            enabled: true,
        } as const;
    }

    // =================================
    // VERIFY 2FA LOGIN
    // =================================
    async function verify2FA(input: {
        userId: string;
        code: string;
        userAgent: string | undefined;
        ip: string | undefined;
    }) {
        const users = await repo.findUserById(input.userId);

        const user = users[0];

        if (!user) {
            throw new InvalidCredentialsError();
        }

        if (!user.twoFactorSecret) {
            logger.warn(
                {
                    userId: input.userId,
                },
                "2FA verification attempted but 2FA not enabled",
            );

            throw new TwoFactorNotEnabledError(input.userId);
        }

        const valid = twoFactorService.verifyTotp(
            user.twoFactorSecret,
            input.code,
        );

        if (!valid) {
            logger.warn(
                {
                    userId: user.id,
                },
                "Invalid TOTP verification code",
            );

            throw new InvalidTwoFactorCodeError(user.id);
        }

        logger.info(
            {
                userId: user.id,
            },
            "2FA verification successful",
        );

        return issueSession({
            userId: user.id,
            userAgent: input.userAgent,
            ip: input.ip,
        });
    }

    // =================================
    // Disable 2FA
    // =================================
    async function disable2FA(userId: string) {
        const users = await repo.findUserById(userId);
        const user = users[0];

        if (!user || !user.twoFactorEnabled) {
            throw new TwoFactorNotEnabledError(userId);
        }

        await repo.disableTwoFactor(userId);

        logger.warn(
            {
                userId,
            },
            "2FA disabled",
        );

        return {
            disabled: true,
        } as const;
    }

    // =================================
    // ISSUE SESSION
    // =================================
    async function issueSession(input: {
        userId: string;
        userAgent: string | undefined;
        ip: string | undefined;
    }) {
        const tokenFamily = crypto.randomUUID();

        // create DB session first
        const session = await repo.createSession({
            userId: input.userId,
            tokenFamily,
            refreshTokenHash: "", // temporary
            userAgent: input.userAgent ?? null,
            ip: input.ip ?? null,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000 * 7),
        });

        const refresh = generateRefreshToken(session.id);
        const [, secret] = refresh.split(".");

        const secretHash = await hashRefreshToken(secret, 10);

        await repo.rotateRefreshToken(session.id, secretHash);

        const accessToken = await tokenService.signAccessToken({
            sub: input.userId,
            sid: session.id,
            typ: "access",
        });

        logger.info(
            {
                userId: input.userId,
                sessionId: session.id,
                tokenFamily,
                ip: input.ip,
                userAgent: input.userAgent,
            },
            "Session issued",
        );

        return {
            accessToken,
            refreshToken: refresh,
            sessionId: session.id,
        };
    }
    // =================================
    // REFRESH TOKEN ROTATION
    // =================================
    async function refresh(refreshToken: string) {
        const [sessionId, secret] = refreshToken.split(".");

        if (!sessionId || !secret) {
            logger.warn(
                {
                    sessionId,
                },
                "Malformed refresh token",
            );

            throw new InvalidRefreshTokenError();
        }

        const sessions = await repo.findSessionById(sessionId);

        const session = sessions[0];

        if (!session || session.revokedAt) {
            logger.warn(
                {
                    sessionId,
                    userId: session?.userId,
                },
                "Refresh attempted on revoked session",
            );

            throw new RefreshTokenRevokedError(sessionId);
        }

        if (session.expiresAt < new Date()) {
            logger.info(
                {
                    sessionId,
                    userId: session.userId,
                },
                "Refresh token expired",
            );

            throw new RefreshTokenExpiredError(sessionId);
        }

        const match = await compareRefreshToken(
            secret,
            session.refreshTokenHash,
        );

        // replay attack
        if (!match) {
            await repo.markSessionCompromised(session.id);
            await repo.revokeTokenFamily(session.tokenFamily);

            logger.error(
                {
                    sessionId,
                    tokenFamily: session.tokenFamily,
                    userId: session.userId,
                },
                "Refresh token replay attack detected. Revoking token family",
            );
            throw new RefreshTokenReuseDetectedError(sessionId);
        }

        // rotate refresh secret
        const newRefresh = generateRefreshToken(session.id);

        const [, newSecret] = newRefresh.split(".");

        const newHash = await hashRefreshToken(newSecret, 10);

        await repo.rotateRefreshToken(session.id, newHash);

        const accessToken = await tokenService.signAccessToken({
            sub: session.userId,
            sid: session.id,
            typ: "access",
        });

        await repo.updateLastUsedAt(session.id);

        logger.info(
            {
                userId: session.userId,
                sessionId: session.id,
            },
            "Refresh token rotated",
        );

        return {
            accessToken,
            refreshToken: newRefresh,
        };
    }

    // =================================
    // LOGOUT
    // =================================
    async function logout(sessionId: string) {
        await repo.revokeSession(sessionId);
        logger.info(
            {
                sessionId,
            },
            "Session revoked",
        );
    }

    async function logoutAll(userId: string) {
        await repo.revokeAllSessions(userId);
        logger.warn(
            {
                userId,
            },
            "All user sessions revoked",
        );
    }

    return {
        signup,
        login,
        verify2FA,
        refresh,
        logout,
        logoutAll,
        confirm2FA,
        setup2FA,
        disable2FA,
    };
}
