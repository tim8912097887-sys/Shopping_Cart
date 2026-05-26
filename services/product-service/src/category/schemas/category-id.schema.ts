import { z } from "zod";

export const categoryIdSchema = z.object({
    id: z.uuid(),
});

export type CategoryIdDto = z.infer<typeof categoryIdSchema>;
