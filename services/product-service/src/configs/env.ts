import z from "zod";

const EnvSchema = z.object({
    NODE_ENV: z
        .enum(["development", "test", "production"], {
            error: "NODE_ENV must be 'development', 'test', or 'production'",
        })
        .default("development"),

    PORT: z.coerce
        .number({
            error: "PORT must be a number",
        })
        .int()
        .positive("PORT must be positive")
        .max(65535)
        .default(3003),

    LOG_LEVEL: z.enum(["error", "warn", "info", "debug"], {
        error: "LOG_LEVEL must be error/warn/info/debug",
    }),

    JWT_ISSUER: z.url("JWT_ISSUER must be valid URL"),

    JWT_AUDIENCE: z.url("JWT_AUDIENCE must be valid URL"),

    ACCESS_PUBLIC_KEY: z
        .string()
        .min(1, "ACCESS_PUBLIC_KEY is required")
        .transform((key) => key.replace(/\\n/g, "\n"))
        .refine((key) => key.includes("BEGIN PUBLIC KEY"), {
            message: "Invalid ACCESS_PUBLIC_KEY PEM format",
        }),
});

const result = EnvSchema.safeParse(process.env);

if (!result.success) {
    const message = result.error.issues
        .map((issue) => issue.message)
        .join(", ");

    console.error(`Environment variables error: ${message}`);

    process.exit(1);
}

export const env = result.data;
