import z from "zod";

export const LoginUserSchema = z.object({
    email: z.email("Invalid Email").trim().toLowerCase(),
    password: z
        .string()
        .min(8, "Password at least eight character")
        .max(50, "Password at most fifty character")
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/,
            "Password should include small and big letter and number and one special character",
        ),
});

export type LoginUserType = z.infer<typeof LoginUserSchema>;

export const RegisterUserSchema = z.object({
    email: z.email("Invalid Email").trim().toLowerCase(),
    password: z
        .string()
        .min(8, "Password at least eight character")
        .max(50, "Password at most fifty character")
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/,
            "Password should include small and big letter and number and one special character",
        ),
});

export type RegisterUserType = z.infer<typeof RegisterUserSchema>;

export const confirm2FASchema = z.object({
    code: z.string().length(6),
});

export type Confirm2FAType = z.infer<typeof confirm2FASchema>;

export const verify2FASchema = z.object({
    userId: z.string(),
    code: z.string().length(6),
});

export type Verify2FAType = z.infer<typeof verify2FASchema>;
