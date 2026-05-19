// plugins/error-handler.ts
import type {
    FastifyError,
    FastifyInstance,
    FastifyReply,
    FastifyRequest,
} from 'fastify';

import { DomainError } from '#common/errors/domain.js';

import { errorResponse } from '#common/response/error.js';

export async function registerErrorHandler(app: FastifyInstance) {
    app.setErrorHandler(
        (
            error: FastifyError | Error,
            request: FastifyRequest,
            reply: FastifyReply,
        ) => {
            // Domain errors
            if (error instanceof DomainError) {
                const statusCode = mapErrorToStatus(error.code);

                return reply
                    .status(statusCode)
                    .send(errorResponse(error.code, error.message));
            }

            // Fastify validation errors
            if ('validation' in error) {
                return reply
                    .status(400)
                    .send(errorResponse('VALIDATION_ERROR', error.message));
            }

            // Unknown errors
            request.log.error(error);

            return reply
                .status(500)
                .send(
                    errorResponse(
                        'INTERNAL_SERVER_ERROR',
                        'Internal server error',
                    ),
                );
        },
    );
}

function mapErrorToStatus(code: string): number {
    switch (code) {
        case 'INVALID_CREDENTIALS':
            return 401;

        case 'EMAIL_ALREADY_EXISTS':
            return 409;

        case 'USER_NOT_VERIFIED':
            return 403;

        case 'SESSION_NOT_FOUND':
            return 404;

        case 'VERIFICATION_CODE_EXPIRED':
            return 410;

        case 'INVALID_VERIFICATION_CODE':
            return 400;

        case 'TOO_MANY_VERIFICATION_REQUESTS':
            return 429;

        case 'REFRESH_TOKEN_EXPIRED':
            return 401;

        case 'REFRESH_TOKEN_REVOKED':
            return 401;

        default:
            return 400;
    }
}
