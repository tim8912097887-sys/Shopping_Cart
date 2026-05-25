import { z } from "zod";

export const createCategorySchema = z.object({
    name: z.string().min(2, "Name too short").max(100),

    slug: z
        .string()
        .min(2)
        .regex(/^[a-z0-9-]+$/, "Slug must be URL-safe"),

    description: z.string().max(500).optional(),

    parentId: z.uuid().nullable().optional(),

    isActive: z.boolean().optional(),
});

export type CreateCategoryDto = z.infer<typeof createCategorySchema>;
