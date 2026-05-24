import nodemailer, { Transporter } from "nodemailer";
import { logger } from "./logger.js";
import { env } from "./env.js";

let transporter: Transporter | null = null;

// Initialize email transporter
export const initializeEmailTransporter = async (): Promise<void> => {
    try {
        const instance = nodemailer.createTransport({
            host: env.EMAIL_HOST,
            port: env.EMAIL_PORT,
            secure: env.EMAIL_SECURE === "true",
            auth: {
                user: env.EMAIL_USER,
                pass: env.EMAIL_PASSWORD,
            },
        });

        // Verify SMTP connection
        await instance.verify();

        transporter = instance;

        logger.info(
            {
                service: "email",
                host: env.EMAIL_HOST,
                port: env.EMAIL_PORT,
                secure: env.EMAIL_SECURE === "true",
            },
            "SMTP transporter initialized",
        );
    } catch (error) {
        logger.error(
            {
                err: error,
                service: "email",
            },
            "SMTP transporter initialization failed",
        );

        transporter = null;
        throw error; // fail fast in production if email is critical
    }
};

// Get email transporter
export const getTransporter = (): Transporter | null => {
    return transporter;
};
