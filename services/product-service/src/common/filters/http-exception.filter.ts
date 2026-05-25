import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
} from "@nestjs/common";
import { Response } from "express";

@Catch()
export class GlobalNotFoundErrorFilter implements ExceptionFilter {
    catch(exception: any, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        // Check if it's a known HTTP exception, otherwise default to Internal Server Error
        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        // Check if it's specifically a 404 error
        if (status === HttpStatus.NOT_FOUND) {
            return response.status(HttpStatus.NOT_FOUND).json({
                statusCode: 404,
                error: "Route Not Found",
                message: `The path you requested does not exist.`,
                timestamp: new Date().toISOString(),
            });
        }

        // Pass through all other exceptions normally
        const exceptionResponse =
            exception instanceof HttpException ? exception.getResponse() : {};
        return response
            .status(status)
            .json(
                typeof exceptionResponse === "object"
                    ? {
                          ...exceptionResponse,
                          timestamp: new Date().toISOString(),
                      }
                    : {
                          message: exceptionResponse,
                          statusCode: status,
                          timestamp: new Date().toISOString(),
                      },
            );
    }
}
