import { RegisterUserType } from "#modules/auth/schema.js";

export const makeAuthUser = (overrides: Partial<Record<string, any>> = {}) => ({
    id: "user-id",
    email: "user@example.com",
    password: "hashed-password",
    twoFactorEnabled: false,
    failLoginAttempts: 0,
    loginLockUntil: null,
    twoFactorSecret: null,
    lastLoginAt: new Date(),
    passwordChangedAt: new Date(),
    verifiedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
});

export const makeRegisterData = (
    overrides: Partial<RegisterUserType> = {},
): RegisterUserType => ({
    email: "user@example.com",
    password: "SecurePassword123!",
    ...overrides,
});

export const makeLoginData = (
    overrides: Partial<{
        email: string;
        password: string;
        userAgent?: string;
        ip?: string;
    }> = {},
) => ({
    email: "user@example.com",
    password: "SecurePassword123!",
    userAgent: "user-agent",
    ip: "127.0.0.1",
    ...overrides,
});

export const makeSession = (overrides: Partial<Record<string, any>> = {}) => ({
    id: "session-id",
    userId: "user-id",
    tokenFamily: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    refreshTokenHash: "hashed-refresh-secret",
    userAgent: "user-agent",
    ip: "127.0.0.1",
    lastUsedAt: new Date(),
    expiresAt: new Date(Date.now() + 100000),
    revokedAt: null,
    compromisedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
});
