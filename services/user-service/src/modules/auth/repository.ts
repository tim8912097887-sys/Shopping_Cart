import { and, eq, isNull, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { auth } from "#infrastructure/db/schema/auth.js";
import { sessions } from "#infrastructure/db/schema/sessions.js";

type DB = PostgresJsDatabase;

export function authRepository(db: DB) {
    return {
        // =================================
        // auth
        // =================================
        async findUserByEmail(email: string) {
            return db
                .select()
                .from(auth)
                .where(and(eq(auth.email, email), isNull(auth.deletedAt)))
                .limit(1);
        },

        async findUserById(userId: string) {
            return db
                .select()
                .from(auth)
                .where(and(eq(auth.id, userId), isNull(auth.deletedAt)))
                .limit(1);
        },

        async createUser(data: { email: string; passwordHash: string }) {
            const [user] = await db
                .insert(auth)
                .values({
                    email: data.email,
                    password: data.passwordHash,
                })
                .returning();

            return user;
        },

        async updateLastLogin(userId: string) {
            await db
                .update(auth)
                .set({
                    lastLoginAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(auth.id, userId));
        },

        // =================================
        // LOGIN LOCKOUT
        // =================================
        async incrementFailedLoginAttempts(userId: string) {
            await db
                .update(auth)
                .set({
                    failLoginAttempts: sql`${auth.failLoginAttempts} + 1`,
                    updatedAt: new Date(),
                })
                .where(eq(auth.id, userId));
        },

        async lockLogin(userId: string, until: Date) {
            await db
                .update(auth)
                .set({
                    loginLockUntil: until,
                    updatedAt: new Date(),
                })
                .where(eq(auth.id, userId));
        },

        async resetLoginAttempts(userId: string) {
            await db
                .update(auth)
                .set({
                    failLoginAttempts: 0,
                    loginLockUntil: null,
                    updatedAt: new Date(),
                })
                .where(eq(auth.id, userId));
        },

        // =================================
        // TOTP
        // =================================
        async updateTwoFactorSecret(userId: string, encryptedSecret: string) {
            await db
                .update(auth)
                .set({
                    twoFactorSecret: encryptedSecret,
                    updatedAt: new Date(),
                })
                .where(eq(auth.id, userId));
        },

        async enableTwoFactor(userId: string) {
            await db
                .update(auth)
                .set({
                    twoFactorEnabled: true,
                    updatedAt: new Date(),
                })
                .where(eq(auth.id, userId));
        },

        async disableTwoFactor(userId: string) {
            await db
                .update(auth)
                .set({
                    twoFactorEnabled: false,
                    twoFactorSecret: null,
                    updatedAt: new Date(),
                })
                .where(eq(auth.id, userId));
        },

        // =================================
        // SESSIONS
        // =================================
        async createSession(data: {
            userId: string;
            refreshTokenHash: string;
            tokenFamily: string;
            userAgent?: string | null;
            ip?: string | null;
            expiresAt: Date;
        }) {
            const [session] = await db
                .insert(sessions)
                .values({
                    userId: data.userId,
                    refreshTokenHash: data.refreshTokenHash,
                    tokenFamily: data.tokenFamily,
                    userAgent: data.userAgent,
                    ip: data.ip,
                    expiresAt: data.expiresAt,
                })
                .returning();

            return session;
        },

        async findSessionById(sessionId: string) {
            return db
                .select()
                .from(sessions)
                .where(
                    and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)),
                )
                .limit(1);
        },

        async rotateRefreshToken(sessionId: string, refreshTokenHash: string) {
            await db
                .update(sessions)
                .set({
                    refreshTokenHash,
                    lastUsedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(sessions.id, sessionId));
        },

        async revokeSession(sessionId: string) {
            await db
                .update(sessions)
                .set({
                    revokedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(sessions.id, sessionId));
        },

        async revokeTokenFamily(tokenFamily: string) {
            await db
                .update(sessions)
                .set({
                    revokedAt: new Date(),
                    compromisedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(sessions.tokenFamily, tokenFamily));
        },

        async revokeAllSessions(userId: string) {
            await db
                .update(sessions)
                .set({
                    revokedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(
                    and(
                        eq(sessions.userId, userId),
                        isNull(sessions.revokedAt),
                    ),
                );
        },

        async updateLastUsedAt(userId: string) {
            await db
                .update(sessions)
                .set({
                    lastUsedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(
                    and(
                        eq(sessions.userId, userId),
                        isNull(sessions.revokedAt),
                    ),
                );
        },

        async markSessionCompromised(sessionId: string) {
            await db
                .update(sessions)
                .set({
                    compromisedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(sessions.id, sessionId));
        },

        async saveTwoFactorSecret(userId: string, secret: string) {
            return db
                .update(auth)
                .set({
                    twoFactorSecret: secret,
                    updatedAt: new Date(),
                })
                .where(eq(auth.id, userId));
        },

        async updateVerifiedAt(userId: string) {
            await db
                .update(auth)
                .set({
                    verifiedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(auth.id, userId));
        },
    };
}

export type AuthRepository = ReturnType<typeof authRepository>;
