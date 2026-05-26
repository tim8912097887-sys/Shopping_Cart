import { DomainError } from "#common/errors/domain.js";
import { mapDomainError } from "#common/errors/error-mapper.js";
import { errorResponse } from "#common/response/error.js";
import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
} from "@nestjs/common";
import { Response } from "express";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = "Internal server error";
        let code = "INTERNAL_ERROR";

        if (exception instanceof HttpException) {
            status = exception.getStatus();

            const res = exception.getResponse();

            if (typeof res === "string") {
                message = res;
            } else {
                message = (res as any).message || message;
            }

            code = (exception as any).name || code;
        } else if (exception instanceof DomainError) {
            const mapped = mapDomainError(exception);

            status = mapped.status;
            code = mapped.code;
            message = mapped.message;
        }

        response.status(status).json(errorResponse(code, message));
    }
}
