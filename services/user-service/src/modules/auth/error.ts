// modules/auth/auth.errors.ts
import { DomainError } from "#common/errors/domain.js";

export class EmailAlreadyExistsError extends DomainError {
    readonly code = "EMAIL_ALREADY_EXISTS";

    constructor(email: string) {
        super("Email already exists", {
            email,
        });
    }
}

export class InvalidCredentialsError extends DomainError {
    readonly code = "INVALID_CREDENTIALS";

    constructor(email?: string) {
        super("Invalid credentials", {
            email,
        });
    }
}

export class VerificationCodeExpiredError extends DomainError {
    readonly code = "VERIFICATION_CODE_EXPIRED";

    constructor(email: string) {
        super("Verification code expired", {
            email,
        });
    }
}

export class InvalidVerificationCodeError extends DomainError {
    readonly code = "INVALID_VERIFICATION_CODE";

    constructor(email: string) {
        super("Invalid verification code", {
            email,
        });
    }
}

export class UserNotVerifiedError extends DomainError {
    readonly code = "USER_NOT_VERIFIED";

    constructor(email: string) {
        super("User is not verified", {
            email,
        });
    }
}

export class TooManyVerificationRequestsError extends DomainError {
    readonly code = "TOO_MANY_VERIFICATION_REQUESTS";

    constructor(email: string, retryAfterSeconds: number) {
        super("Too many verification requests", {
            email,
            retryAfterSeconds,
        });
    }
}

export class RefreshTokenExpiredError extends DomainError {
    readonly code = "REFRESH_TOKEN_EXPIRED";

    constructor(sessionId?: string) {
        super("Refresh token expired", {
            sessionId,
        });
    }
}

export class RefreshTokenRevokedError extends DomainError {
    readonly code = "REFRESH_TOKEN_REVOKED";

    constructor(sessionId?: string) {
        super("Refresh token revoked", {
            sessionId,
        });
    }
}

export class SessionNotFoundError extends DomainError {
    readonly code = "SESSION_NOT_FOUND";

    constructor(sessionId: string) {
        super("Session not found", {
            sessionId,
        });
    }
}
