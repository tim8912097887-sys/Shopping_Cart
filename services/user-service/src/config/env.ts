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
        .default(3000),

    LOG_LEVEL: z.enum(["error", "warn", "info", "debug"], {
        error: "LOG_LEVEL must be error/warn/info/debug",
    }),

    DATABASE_URL: z
        .string()
        .regex(
            /^postgresql:\/\/(?:([^:\s]+):([^@\s]+)@)?([^:/\s]+)(?::(\d+))?\/([^\s?]+)(?:\?(.+))?$/,
            "Database URL is invalid",
        ),

    JWT_ISSUER: z.url("JWT_ISSUER must be valid URL"),

    JWT_AUDIENCE: z.url("JWT_AUDIENCE must be valid URL"),

    REDIS_URL: z
        .string()
        .refine(
            (url) => url.startsWith("redis://") || url.startsWith("rediss://"),
            {
                message: "Invalid Redis URL",
            },
        ),

    ACCESS_TOKEN_EXPIRES_IN: z
        .string()
        .regex(
            /^\d+[smhd]$/,
            "ACCESS_TOKEN_EXPIRES_IN must be like 15m / 1h / 7d",
        ),

    REFRESH_TOKEN_EXPIRES_IN: z
        .string()
        .regex(/^\d+[smhd]$/, "REFRESH_TOKEN_EXPIRES_IN must be like 7d / 30d"),

    ACCESS_PRIVATE_KEY: z
        .string()
        .min(1, "ACCESS_PRIVATE_KEY is required")
        .transform((key) => key.replace(/\\n/g, "\n"))
        .refine((key) => key.includes("BEGIN PRIVATE KEY"), {
            message: "Invalid ACCESS_PRIVATE_KEY PEM format",
        }),

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
