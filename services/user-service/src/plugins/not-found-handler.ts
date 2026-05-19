import { ERROR_CODE } from '#common/errors/types.js';
import { errorResponse } from '#common/response/error.js';
import type { FastifyInstance } from 'fastify';

export async function registerNotFoundHandler(app: FastifyInstance) {
    app.setNotFoundHandler((request, reply) => {
        return reply
            .status(ERROR_CODE.NOT_FOUND)
            .send(
                errorResponse(
                    'ROUTE_NOT_FOUND',
                    `Route ${request.method} ${request.url} not found`,
                ),
            );
    });
}
