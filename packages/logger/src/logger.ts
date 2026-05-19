import pino, { type LoggerOptions } from 'pino';

export function createLogger(service: string) {
    const options: LoggerOptions = {
        level: process.env.LOG_LEVEL || 'info',

        base: {
            service,
        },

        redact: {
            paths: [
                'password',
                'token',
                'accessToken',
                'refreshToken',
                'authorization',
            ],
            censor: '[REDACTED]',
        },

        timestamp: pino.stdTimeFunctions.isoTime,
    };

    if (process.env.NODE_ENV === 'development') {
        options.transport = {
            target: 'pino-pretty',
            options: {
                colorize: true,
            },
        };
    }

    return pino(options);
}
