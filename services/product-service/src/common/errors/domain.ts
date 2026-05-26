export abstract class DomainError extends Error {
    abstract readonly code: string;

    constructor(
        message: string,
        public readonly metadata?: Record<string, unknown>,
    ) {
        super(message);

        this.name = new.target.name;

        Error.captureStackTrace(this, this.constructor);
    }
}
