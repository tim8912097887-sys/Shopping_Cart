export class EmailError extends Error {
    constructor(
        message: string,
        public readonly cause?: unknown,
    ) {
        super(message);
        this.name = "EmailError";
    }
}

export class EmailTransportNotInitializedError extends EmailError {
    constructor() {
        super("Email transporter is not initialized");
        this.name = "EmailTransportNotInitializedError";
    }
}

export class EmailSendFailedError extends EmailError {
    constructor(cause?: unknown) {
        super("Failed to send email", cause);
        this.name = "EmailSendFailedError";
    }
}
