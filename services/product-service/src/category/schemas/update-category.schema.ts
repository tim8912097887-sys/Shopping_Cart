import { z } from "zod";
import { createCategorySchema } from "./create-category.schema.js";

export const updateCategorySchema = createCategorySchema.partial();

export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;
