import { getTransporter } from "#configs/email.js";
import { logger } from "#configs/logger.js";

import {
    EmailSendFailedError,
    EmailTransportNotInitializedError,
} from "./error.js";

type EmailOptions = {
    from: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
};

export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
    const transporter = getTransporter();

    if (!transporter) {
        logger.error(
            {
                service: "email",
            },
            "SMTP transporter unavailable",
        );

        throw new EmailTransportNotInitializedError();
    }

    try {
        const info = await transporter.sendMail(options);

        logger.info(
            {
                service: "email",
                to: options.to,
                subject: options.subject,
                messageId: info.messageId,
            },
            "Email sent successfully",
        );

        return true;
    } catch (error) {
        logger.error(
            {
                err: error,
                service: "email",
                to: options.to,
                subject: options.subject,
            },
            "Email send failed",
        );

        throw new EmailSendFailedError(error);
    }
};
