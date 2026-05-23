import {
    compareOTP,
    comparePassword,
    compareRefreshToken,
    generateOTP,
    generateQrCode,
    generateRefreshToken,
    hashPassword,
    hashRefreshToken,
    loginAttemptHandle,
} from "./util.js";
import type { AuthRepository } from "./repository.js";
import { TokenService, TwoFactorService, OtpRepository } from "./types.js";
import {
    AccountLockedError,
    InvalidCredentialsError,
    InvalidOtpError,
    InvalidRefreshTokenError,
    InvalidTwoFactorCodeError,
    OtpExpiredError,
    RefreshTokenExpiredError,
    RefreshTokenReuseDetectedError,
    RefreshTokenRevokedError,
    TwoFactorNotEnabledError,
} from "./error.js";
import { RegisterUserType, VerifyAccountType } from "./schema.js";
import { MessageBrokerType, TOPICS } from "@shoppingcart/message-broker";
import { AUTH_LIMITS } from "./constants.js";

export function authService(deps: {
    repo: AuthRepository;
    otpRepo: OtpRepository;
    tokenService: TokenService;
    twoFactorService: TwoFactorService;
    logger: any;
    producer: MessageBrokerType["producer"];
}) {
    const { repo, tokenService, twoFactorService, logger, otpRepo, producer } =
        deps;

    // =================================
    // SIGNUP
    // =================================
    async function signup(input: RegisterUserType) {
        const existing = await repo.findUserByEmail(input.email);

        if (existing.length > 0) {
            if (existing[0].verifiedAt) {
                logger.warn(
                    {
                        event: "user_signup_verified",
                        service: "user-service",
                        email: input.email,
                    },
                    "User already exists and is verified",
                );
                await producer.publish({
                    topic: TOPICS.USER_CREATED_WARNING,
                    payload: {
                        email: input.email,
                    },
                });
                return {
                    id: existing[0].id,
                    email: existing[0].email,
                };
            } else {
                logger.warn(
                    {
                        event: "user_signup_unverified",
                        service: "user-service",
                        email: input.email,
                    },
                    "User already exists and is not verified",
                );
                const code = generateOTP();
                const hashedCode = await hashPassword(code, 12);
                await otpRepo.createOtp({
                    userId: existing[0].id,
                    code: hashedCode,
                    otpType: "email_verification",
                });
                // send created email
                await producer.publish({
                    topic: TOPICS.USER_CREATED,
                    payload: {
                        email: input.email,
                        code,
                    },
                });
                return {
                    id: existing[0].id,
                    email: existing[0].email,
                };
            }
        }

        const passwordHash = await hashPassword(input.password, 12);

        const user = await repo.createUser({
            email: input.email,
            passwordHash,
        });

        logger.info(
            {
                event: "user_created",
                service: "user-service",
                email: input.email,
            },
            "User created",
        );
        const code = generateOTP();
        const hashedCode = await hashPassword(code, 12);
        await otpRepo.createOtp({
            userId: user.id,
            code: hashedCode,
            otpType: "email_verification",
        });
        // send created email
        await producer.publish({
            topic: TOPICS.USER_CREATED,
            payload: {
                email: input.email,
                code,
            },
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

        if (!user.verifiedAt) {
            logger.warn(
                {
                    userId: user.id,
                    email: input.email,
                },
                "Login blocked: account not verified",
            );
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
            const lockTime = await loginAttemptHandle({ attempt: attempts });
            if (lockTime) {
                const lockUntil = lockTime;
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
    // Verify Account
    // =================================
    async function verifyAccount(verifyInfo: VerifyAccountType) {
        const { code, email } = verifyInfo;

        const users = await repo.findUserByEmail(email);
        const user = users[0];

        // =========================
        // USER VALIDATION
        // =========================
        if (!user) {
            logger.warn(
                {
                    event: "verify_account_user_not_found",
                    service: "user-service",
                    email,
                },
                "Account verification failed: user not found",
            );

            throw new InvalidCredentialsError(email);
        }

        if (user.verifiedAt) {
            logger.warn(
                {
                    event: "verify_account_already_verified",
                    service: "user-service",
                    userId: user.id,
                    email,
                },
                "Account verification attempted on verified account",
            );

            throw new InvalidCredentialsError(email);
        }

        // =========================
        // OTP LOOKUP
        // =========================
        const otp = await otpRepo.getOtp({
            otpType: "email_verification",
            userId: user.id,
        });

        if (!otp) {
            logger.warn(
                {
                    event: "verify_account_otp_missing",
                    service: "user-service",
                    userId: user.id,
                    email,
                },
                "Account verification failed: OTP expired or missing",
            );

            throw new OtpExpiredError();
        }

        // =========================
        // VERIFY OTP
        // =========================
        const isMatch = await compareOTP(code, otp.code);

        if (!isMatch) {
            const attempt = await otpRepo.incrementOtpAttempt({
                otpType: "email_verification",
                userId: user.id,
            });

            logger.warn(
                {
                    event: "verify_account_invalid_otp",
                    service: "user-service",
                    userId: user.id,
                    email,
                    attempts: attempt,
                },
                "Invalid account verification code",
            );

            if (attempt >= AUTH_LIMITS.OTP_MAX_ATTEMPTS) {
                logger.error(
                    {
                        event: "verify_account_otp_max_attempts",
                        service: "user-service",
                        userId: user.id,
                        email,
                    },
                    "OTP invalidated after max verification attempts",
                );
            }

            throw new InvalidOtpError();
        }

        // =========================
        // SUCCESS
        // =========================
        await otpRepo.deleteOtp({
            otpType: "email_verification",
            userId: user.id,
        });

        await repo.updateVerifiedAt(user.id);

        logger.info(
            {
                event: "account_verified",
                service: "user-service",
                userId: user.id,
                email,
            },
            "Account verified successfully",
        );

        return {
            verified: true,
        } as const;
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
        verifyAccount,
    };
}
