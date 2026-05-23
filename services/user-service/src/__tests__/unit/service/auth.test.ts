import crypto from "node:crypto";
import { describe, expect, it, beforeEach, vi, Mocked } from "vitest";
import { authService } from "#modules/auth/service.js";
import * as authUtil from "#modules/auth/util.js";
import type { VerifyAccountType } from "#modules/auth/schema.js";
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
} from "#modules/auth/error.js";
import { AuthRepository } from "#modules/auth/repository.js";
import { MessageBrokerType, TOPICS } from "@shoppingcart/message-broker";
import {
    AuthService,
    TokenService,
    TwoFactorService,
    OtpRepository,
} from "#modules/auth/types.js";
import { AUTH_LIMITS } from "#modules/auth/constants.js";
import {
    makeAuthUser,
    makeLoginData,
    makeRegisterData,
    makeSession,
} from "#__tests__/utils/auth.js";

describe("Auth Service", () => {
    let mockRepo: Mocked<AuthRepository>;
    let mockOtpRepo: Mocked<OtpRepository>;
    let mockTokenService: Mocked<TokenService>;
    let mockTwoFactorService: Mocked<TwoFactorService>;
    let mockLogger: Record<string, any>;
    let mockProducer: Mocked<MessageBrokerType["producer"]>;
    let auth: Mocked<AuthService>;

    beforeEach(() => {
        mockRepo = {
            findUserByEmail: vi.fn(),
            createUser: vi.fn(),
            findUserById: vi.fn(),
            incrementFailedLoginAttempts: vi.fn(),
            lockLogin: vi.fn(),
            resetLoginAttempts: vi.fn(),
            updateLastLogin: vi.fn(),
            updateVerifiedAt: vi.fn(),
            saveTwoFactorSecret: vi.fn(),
            enableTwoFactor: vi.fn(),
            disableTwoFactor: vi.fn(),
            createSession: vi.fn(),
            rotateRefreshToken: vi.fn(),
            findSessionById: vi.fn(),
            markSessionCompromised: vi.fn(),
            revokeTokenFamily: vi.fn(),
            updateLastUsedAt: vi.fn(),
            revokeSession: vi.fn(),
            revokeAllSessions: vi.fn(),
        } as unknown as Mocked<AuthRepository>;

        mockOtpRepo = {
            createOtp: vi.fn(),
            getOtp: vi.fn(),
            incrementOtpAttempt: vi.fn(),
            deleteOtp: vi.fn(),
            getCooldownTtl: vi.fn(),
            otpExists: vi.fn(),
        } as unknown as Mocked<OtpRepository>;

        mockTokenService = {
            signAccessToken: vi.fn(),
        } as unknown as Mocked<TokenService>;

        mockTwoFactorService = {
            generateSecret: vi.fn(),
            generateOtpAuthUrl: vi.fn(),
            verifyTotp: vi.fn(),
        } as unknown as Mocked<TwoFactorService>;

        mockLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };

        mockProducer = {
            publish: vi.fn(),
        } as unknown as Mocked<MessageBrokerType["producer"]>;

        auth = authService({
            repo: mockRepo,
            otpRepo: mockOtpRepo,
            tokenService: mockTokenService,
            twoFactorService: mockTwoFactorService,
            logger: mockLogger,
            producer: mockProducer,
        }) as unknown as Mocked<AuthService>;
    });

    describe("signup", () => {
        it("creates a new user when email does not already exist", async () => {
            const input = makeRegisterData();
            const existingUser: [] = [];
            const createdUser = makeAuthUser({
                email: input.email,
                id: "created-id",
            });

            mockRepo.findUserByEmail.mockResolvedValue(existingUser);
            mockRepo.createUser.mockResolvedValue(createdUser);
            vi.spyOn(authUtil, "generateOTP").mockReturnValue("123456");
            vi.spyOn(authUtil, "hashPassword").mockResolvedValue(
                "hashed-password",
            );

            const result = await auth.signup(input);

            expect(mockRepo.findUserByEmail).toHaveBeenCalledWith(input.email);
            expect(authUtil.hashPassword).toHaveBeenCalledWith(
                input.password,
                12,
            );
            expect(mockRepo.createUser).toHaveBeenCalledWith({
                email: input.email,
                passwordHash: "hashed-password",
            });
            expect(mockOtpRepo.createOtp).toHaveBeenCalledWith({
                userId: createdUser.id,
                code: "hashed-password",
                otpType: "email_verification",
            });
            expect(mockProducer.publish).toHaveBeenCalledWith({
                topic: TOPICS.USER_CREATED,
                payload: {
                    email: input.email,
                    code: "123456",
                },
            });
            expect(result).toEqual({
                id: createdUser.id,
                email: createdUser.email,
            });
        });

        it("resends a verification OTP when the email exists and is not verified", async () => {
            const input = makeRegisterData();
            const existingUser = makeAuthUser({
                email: input.email,
                verifiedAt: null,
                id: "existing-id",
            });

            mockRepo.findUserByEmail.mockResolvedValue([existingUser]);
            vi.spyOn(authUtil, "generateOTP").mockReturnValue("654321");
            vi.spyOn(authUtil, "hashPassword").mockResolvedValue("hashed-code");

            const result = await auth.signup(input);

            expect(mockRepo.createUser).not.toHaveBeenCalled();
            expect(mockOtpRepo.createOtp).toHaveBeenCalledWith({
                userId: existingUser.id,
                code: "hashed-code",
                otpType: "email_verification",
            });
            expect(mockProducer.publish).toHaveBeenCalledWith({
                topic: TOPICS.USER_CREATED,
                payload: {
                    email: input.email,
                    code: "654321",
                },
            });
            expect(result).toEqual({
                id: existingUser.id,
                email: existingUser.email,
            });
        });

        it("returns existing verified user info when the email already exists and is verified", async () => {
            const input = makeRegisterData();
            const existingUser = makeAuthUser({
                email: input.email,
                verifiedAt: new Date(),
                id: "existing-id",
            });

            mockRepo.findUserByEmail.mockResolvedValue([existingUser]);

            const result = await auth.signup(input);

            expect(mockRepo.createUser).not.toHaveBeenCalled();
            expect(mockOtpRepo.createOtp).not.toHaveBeenCalled();
            expect(mockProducer.publish).toHaveBeenCalledWith({
                topic: TOPICS.USER_CREATED_WARNING,
                payload: {
                    email: input.email,
                },
            });
            expect(result).toEqual({
                id: existingUser.id,
                email: existingUser.email,
            });
        });
    });

    describe("verifyAccount", () => {
        const makeVerifyInput = (
            overrides: Partial<VerifyAccountType> = {},
        ): VerifyAccountType => ({
            email: "user@example.com",
            code: "123456",
            ...overrides,
        });

        it("verifies the account when the OTP is valid", async () => {
            const user = makeAuthUser({ verifiedAt: null });
            const otp = { code: "hashed-code", attempt: 0 };
            const input = makeVerifyInput();

            mockRepo.findUserByEmail.mockResolvedValue([user]);
            mockOtpRepo.getOtp.mockResolvedValue(otp as any);
            vi.spyOn(authUtil, "compareOTP").mockResolvedValue(true);

            const result = await auth.verifyAccount(input);

            expect(mockOtpRepo.deleteOtp).toHaveBeenCalledWith({
                otpType: "email_verification",
                userId: user.id,
            });
            expect(mockRepo.updateVerifiedAt).toHaveBeenCalledWith(user.id);
            expect(result).toEqual({ verified: true });
        });

        it("throws InvalidCredentialsError when the user is not found", async () => {
            const input = makeVerifyInput();

            mockRepo.findUserByEmail.mockResolvedValue([]);

            await expect(auth.verifyAccount(input)).rejects.toBeInstanceOf(
                InvalidCredentialsError,
            );
            expect(mockOtpRepo.getOtp).not.toHaveBeenCalled();
        });

        it("throws InvalidCredentialsError when the account is already verified", async () => {
            const user = makeAuthUser({ verifiedAt: new Date() });
            const input = makeVerifyInput();

            mockRepo.findUserByEmail.mockResolvedValue([user]);

            await expect(auth.verifyAccount(input)).rejects.toBeInstanceOf(
                InvalidCredentialsError,
            );
            expect(mockOtpRepo.getOtp).not.toHaveBeenCalled();
        });

        it("throws OtpExpiredError when the verification OTP is missing", async () => {
            const user = makeAuthUser({ verifiedAt: null });
            const input = makeVerifyInput();

            mockRepo.findUserByEmail.mockResolvedValue([user]);
            mockOtpRepo.getOtp.mockResolvedValue(null);

            await expect(auth.verifyAccount(input)).rejects.toBeInstanceOf(
                OtpExpiredError,
            );
            expect(mockRepo.updateVerifiedAt).not.toHaveBeenCalled();
        });

        it("throws InvalidOtpError when the OTP code is invalid", async () => {
            const user = makeAuthUser({ verifiedAt: null });
            const input = makeVerifyInput();

            mockRepo.findUserByEmail.mockResolvedValue([user]);
            mockOtpRepo.getOtp.mockResolvedValue({
                code: "hashed-code",
            } as any);
            vi.spyOn(authUtil, "compareOTP").mockResolvedValue(false);
            mockOtpRepo.incrementOtpAttempt.mockResolvedValue(1);

            await expect(auth.verifyAccount(input)).rejects.toBeInstanceOf(
                InvalidOtpError,
            );
            expect(mockOtpRepo.incrementOtpAttempt).toHaveBeenCalledWith({
                otpType: "email_verification",
                userId: user.id,
            });
            expect(mockRepo.updateVerifiedAt).not.toHaveBeenCalled();
        });

        it("throws InvalidOtpError when the invalid OTP attempt reaches the maximum", async () => {
            const user = makeAuthUser({ verifiedAt: null });
            const input = makeVerifyInput();

            mockRepo.findUserByEmail.mockResolvedValue([user]);
            mockOtpRepo.getOtp.mockResolvedValue({
                code: "hashed-code",
            } as any);
            vi.spyOn(authUtil, "compareOTP").mockResolvedValue(false);
            mockOtpRepo.incrementOtpAttempt.mockResolvedValue(
                AUTH_LIMITS.OTP_MAX_ATTEMPTS,
            );

            await expect(auth.verifyAccount(input)).rejects.toBeInstanceOf(
                InvalidOtpError,
            );
            expect(mockOtpRepo.incrementOtpAttempt).toHaveBeenCalledWith({
                otpType: "email_verification",
                userId: user.id,
            });
            expect(mockRepo.updateVerifiedAt).not.toHaveBeenCalled();
        });
    });

    describe("login", () => {
        it("issues a session for valid credentials when 2FA is disabled", async () => {
            const input = makeLoginData();
            const user = makeAuthUser({ password: "hashed-password" });
            const session = makeSession();

            mockRepo.findUserByEmail.mockResolvedValue([user]);
            vi.spyOn(authUtil, "comparePassword").mockResolvedValue(true);
            vi.spyOn(crypto, "randomUUID").mockReturnValue(
                "f47ac10b-58cc-4372-a567-0e02b2c3d479" as any,
            );
            mockRepo.createSession.mockResolvedValue(session);
            vi.spyOn(authUtil, "generateRefreshToken").mockReturnValue(
                `${session.id}.refresh-secret`,
            );
            vi.spyOn(authUtil, "hashRefreshToken").mockResolvedValue(
                "hashed-refresh-secret",
            );
            mockTokenService.signAccessToken.mockResolvedValue("access-token");

            const result = await auth.login(input);

            expect(mockRepo.resetLoginAttempts).toHaveBeenCalledWith(user.id);
            expect(mockRepo.updateLastLogin).toHaveBeenCalledWith(user.id);
            expect(mockRepo.createSession).toHaveBeenCalledWith({
                userId: user.id,
                tokenFamily: expect.any(String),
                refreshTokenHash: "",
                userAgent: input.userAgent,
                ip: input.ip,
                expiresAt: expect.any(Date),
            });
            expect(mockRepo.rotateRefreshToken).toHaveBeenCalledWith(
                session.id,
                "hashed-refresh-secret",
            );
            expect(mockTokenService.signAccessToken).toHaveBeenCalledWith({
                sub: user.id,
                sid: session.id,
                typ: "access",
            });
            expect(result).toEqual({
                accessToken: "access-token",
                refreshToken: `${session.id}.refresh-secret`,
                sessionId: session.id,
            });
        });

        it("throws InvalidCredentialsError when the user is not found", async () => {
            const input = makeLoginData();
            mockRepo.findUserByEmail.mockResolvedValue([]);

            await expect(auth.login(input)).rejects.toBeInstanceOf(
                InvalidCredentialsError,
            );
            expect(
                mockRepo.incrementFailedLoginAttempts,
            ).not.toHaveBeenCalled();
        });

        it("increments failed login attempts and throws InvalidCredentialsError for wrong password", async () => {
            const input = makeLoginData();
            const user = makeAuthUser({ password: "hashed-password" });

            mockRepo.findUserByEmail.mockResolvedValue([user]);
            vi.spyOn(authUtil, "comparePassword").mockResolvedValue(false);

            await expect(auth.login(input)).rejects.toBeInstanceOf(
                InvalidCredentialsError,
            );
            expect(mockRepo.incrementFailedLoginAttempts).toHaveBeenCalledWith(
                user.id,
            );
            expect(mockRepo.resetLoginAttempts).not.toHaveBeenCalled();
        });

        it("increments failed login attempts and throws InvalidCredentialsError and locks the account for over five times in a row", async () => {
            const input = makeLoginData();
            const user = makeAuthUser({
                password: "hashed-password",
                failLoginAttempts: 4,
            });

            mockRepo.findUserByEmail.mockResolvedValue([user]);
            vi.spyOn(authUtil, "comparePassword").mockResolvedValue(false);

            await expect(auth.login(input)).rejects.toBeInstanceOf(
                InvalidCredentialsError,
            );
            expect(mockRepo.incrementFailedLoginAttempts).toHaveBeenCalledWith(
                user.id,
            );
            expect(mockRepo.lockLogin).toHaveBeenCalledWith(
                user.id,
                expect.any(Date),
            );
            expect(mockRepo.resetLoginAttempts).not.toHaveBeenCalled();
        });

        it("throws AccountLockedError when the account is locked", async () => {
            const lockUntil = new Date(Date.now() + 10000).toISOString();
            const input = makeLoginData();
            const user = makeAuthUser({ loginLockUntil: lockUntil });

            mockRepo.findUserByEmail.mockResolvedValue([user]);

            await expect(auth.login(input)).rejects.toBeInstanceOf(
                AccountLockedError,
            );
            expect(
                mockRepo.incrementFailedLoginAttempts,
            ).not.toHaveBeenCalled();
        });

        it("returns requires2FA when 2FA is enabled", async () => {
            const input = makeLoginData();
            const user = makeAuthUser({
                password: "hashed-password",
                twoFactorEnabled: true,
            });

            mockRepo.findUserByEmail.mockResolvedValue([user]);
            vi.spyOn(authUtil, "comparePassword").mockResolvedValue(true);
            mockRepo.resetLoginAttempts.mockResolvedValue(undefined);
            mockRepo.updateLastLogin.mockResolvedValue(undefined);

            const result = await auth.login(input);

            expect(result).toEqual({ requires2FA: true, userId: user.id });
        });
    });

    describe("2FA", () => {
        it("sets up 2FA and stores the generated secret", async () => {
            const user = makeAuthUser({ email: "user@example.com" });
            const secret = "secret-value";
            const otpAuthUrl = "otpauth://totp/...";
            const qrcode = "data:image/png;base64,....";

            mockRepo.findUserById.mockResolvedValue([user]);
            mockTwoFactorService.generateSecret.mockReturnValue(secret);
            mockTwoFactorService.generateOtpAuthUrl.mockReturnValue(otpAuthUrl);
            vi.spyOn(authUtil, "generateQrCode").mockResolvedValue(qrcode);

            const result = await auth.setup2FA(user.id);

            expect(mockRepo.saveTwoFactorSecret).toHaveBeenCalledWith(
                user.id,
                secret,
            );
            expect(result).toEqual({ secret, otpAuthUrl, qrcode });
        });

        it("throws InvalidCredentialsError when setup2FA is called for a missing user", async () => {
            mockRepo.findUserById.mockResolvedValue([]);

            await expect(auth.setup2FA("missing-id")).rejects.toBeInstanceOf(
                InvalidCredentialsError,
            );
        });

        it("confirms 2FA and enables it when the code is valid", async () => {
            const user = makeAuthUser({ twoFactorSecret: "totp-secret" });
            mockRepo.findUserById.mockResolvedValue([user]);
            mockTwoFactorService.verifyTotp.mockReturnValue(true);

            const result = await auth.confirm2FA({
                userId: user.id,
                code: "123456",
            });

            expect(mockRepo.enableTwoFactor).toHaveBeenCalledWith(user.id);
            expect(result).toEqual({ enabled: true });
        });

        it("throws InvalidTwoFactorCodeError when confirm2FA code is invalid", async () => {
            const user = makeAuthUser({ twoFactorSecret: "totp-secret" });
            mockRepo.findUserById.mockResolvedValue([user]);
            mockTwoFactorService.verifyTotp.mockReturnValue(false);

            await expect(
                auth.confirm2FA({ userId: user.id, code: "000000" }),
            ).rejects.toBeInstanceOf(InvalidTwoFactorCodeError);
        });

        it("throws TwoFactorNotEnabledError when confirm2FA is called without a stored secret", async () => {
            const user = makeAuthUser({ twoFactorSecret: null });
            mockRepo.findUserById.mockResolvedValue([user]);

            await expect(
                auth.confirm2FA({ userId: user.id, code: "123456" }),
            ).rejects.toBeInstanceOf(TwoFactorNotEnabledError);
        });

        it("throws TwoFactorNotEnabledError when confirm2FA is called with a missing user", async () => {
            const user = makeAuthUser({ twoFactorSecret: "totp-secret" });
            mockRepo.findUserById.mockResolvedValue([]);

            await expect(
                auth.confirm2FA({ userId: user.id, code: "123456" }),
            ).rejects.toBeInstanceOf(TwoFactorNotEnabledError);
        });

        it("verifies 2FA and issues a session when the code is valid", async () => {
            const user = makeAuthUser({
                id: "user-id",
                twoFactorSecret: "totp-secret",
            });
            const session = makeSession();

            mockRepo.findUserById.mockResolvedValue([user]);
            mockTwoFactorService.verifyTotp.mockReturnValue(true);
            vi.spyOn(crypto, "randomUUID").mockReturnValue(
                "f47ac10b-58cc-4372-a567-0e02b2c3d479" as any,
            );
            mockRepo.createSession.mockResolvedValue(session);
            vi.spyOn(authUtil, "generateRefreshToken").mockReturnValue(
                `${session.id}.refresh-secret`,
            );
            vi.spyOn(authUtil, "hashRefreshToken").mockResolvedValue(
                "hashed-refresh-secret",
            );
            mockTokenService.signAccessToken.mockResolvedValue("access-token");

            const result = await auth.verify2FA({
                userId: user.id,
                code: "123456",
                userAgent: "user-agent",
                ip: "127.0.0.1",
            });

            expect(result).toEqual({
                accessToken: "access-token",
                refreshToken: `${session.id}.refresh-secret`,
                sessionId: session.id,
            });
        });

        it("throws TwoFactorNotEnabledError when verify2FA is called for a non-2FA user", async () => {
            const user = makeAuthUser({ twoFactorSecret: null });
            mockRepo.findUserById.mockResolvedValue([user]);

            await expect(
                auth.verify2FA({
                    userId: user.id,
                    code: "123456",
                    userAgent: "user-agent",
                    ip: "127.0.0.1",
                }),
            ).rejects.toBeInstanceOf(TwoFactorNotEnabledError);
        });

        it("throws InvalidTwoFactorCodeError when verify2FA code is invalid", async () => {
            const user = makeAuthUser({
                id: "user-id",
                twoFactorSecret: "totp-secret",
            });
            mockRepo.findUserById.mockResolvedValue([user]);
            mockTwoFactorService.verifyTotp.mockReturnValue(false);

            await expect(
                auth.verify2FA({
                    userId: user.id,
                    code: "000000",
                    userAgent: "user-agent",
                    ip: "127.0.0.1",
                }),
            ).rejects.toBeInstanceOf(InvalidTwoFactorCodeError);
        });

        it("disables 2FA successfully when enabled", async () => {
            const user = makeAuthUser({
                id: "user-id",
                twoFactorEnabled: true,
            });
            mockRepo.findUserById.mockResolvedValue([user]);

            const result = await auth.disable2FA(user.id);

            expect(mockRepo.disableTwoFactor).toHaveBeenCalledWith(user.id);
            expect(result).toEqual({ disabled: true });
        });

        it("throws TwoFactorNotEnabledError when disable2FA is called and 2FA is not enabled", async () => {
            const user = makeAuthUser({
                id: "user-id",
                twoFactorEnabled: false,
            });
            mockRepo.findUserById.mockResolvedValue([user]);

            await expect(auth.disable2FA(user.id)).rejects.toBeInstanceOf(
                TwoFactorNotEnabledError,
            );
        });

        it("throws TwoFactorNotEnabledError when disable2FA is called and user is not found", async () => {
            const user = makeAuthUser({
                id: "user-id",
                twoFactorEnabled: false,
            });
            mockRepo.findUserById.mockResolvedValue([]);

            await expect(auth.disable2FA(user.id)).rejects.toBeInstanceOf(
                TwoFactorNotEnabledError,
            );
        });
    });

    describe("refresh", () => {
        it("rotates a valid refresh token and returns new session tokens", async () => {
            const session = makeSession({
                tokenFamily: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
                revokedAt: null,
                expiresAt: new Date(Date.now() + 100000),
            });
            const refreshToken = `${session.id}.refresh-secret`;

            mockRepo.findSessionById.mockResolvedValue([session]);
            vi.spyOn(authUtil, "compareRefreshToken").mockResolvedValue(true);
            vi.spyOn(authUtil, "generateRefreshToken").mockReturnValue(
                `${session.id}.new-secret`,
            );
            vi.spyOn(authUtil, "hashRefreshToken").mockResolvedValue(
                "new-hashed-secret",
            );
            mockTokenService.signAccessToken.mockResolvedValue(
                "new-access-token",
            );

            const result = await auth.refresh(refreshToken);

            expect(mockRepo.rotateRefreshToken).toHaveBeenCalledWith(
                session.id,
                "new-hashed-secret",
            );
            expect(mockRepo.updateLastUsedAt).toHaveBeenCalledWith(session.id);
            expect(result).toEqual({
                accessToken: "new-access-token",
                refreshToken: `${session.id}.new-secret`,
            });
        });

        it("throws InvalidRefreshTokenError for malformed refresh tokens", async () => {
            await expect(
                auth.refresh("malformed-token"),
            ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
        });

        it("throws RefreshTokenRevokedError when the session is revoked", async () => {
            const session = makeSession({
                revokedAt: new Date(),
            });

            mockRepo.findSessionById.mockResolvedValue([session]);

            await expect(
                auth.refresh(`${session.id}.secret`),
            ).rejects.toBeInstanceOf(RefreshTokenRevokedError);
            expect(mockRepo.markSessionCompromised).not.toHaveBeenCalled();
        });

        it("throws RefreshTokenExpiredError when the refresh session is expired", async () => {
            const session = makeSession({
                expiresAt: new Date(Date.now() - 10000),
            });

            mockRepo.findSessionById.mockResolvedValue([session]);

            await expect(
                auth.refresh(`${session.id}.secret`),
            ).rejects.toBeInstanceOf(RefreshTokenExpiredError);
        });

        it("detects refresh token reuse and revokes the token family", async () => {
            const session = makeSession({
                tokenFamily: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
            });

            mockRepo.findSessionById.mockResolvedValue([session]);
            vi.spyOn(authUtil, "compareRefreshToken").mockResolvedValue(false);

            await expect(
                auth.refresh(`${session.id}.secret`),
            ).rejects.toBeInstanceOf(RefreshTokenReuseDetectedError);
            expect(mockRepo.markSessionCompromised).toHaveBeenCalledWith(
                session.id,
            );
            expect(mockRepo.revokeTokenFamily).toHaveBeenCalledWith(
                session.tokenFamily,
            );
        });
    });

    describe("logout", () => {
        it("revokes a single session", async () => {
            await auth.logout("session-id");

            expect(mockRepo.revokeSession).toHaveBeenCalledWith("session-id");
        });

        it("revokes all sessions for a user", async () => {
            await auth.logoutAll("user-id");

            expect(mockRepo.revokeAllSessions).toHaveBeenCalledWith("user-id");
        });
    });
});
