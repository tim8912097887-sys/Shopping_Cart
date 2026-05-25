import { PipeTransform, Injectable, BadRequestException } from "@nestjs/common";
import { ZodObject } from "zod";

@Injectable()
export class ZodValidationPipe implements PipeTransform {
    constructor(private readonly schema: ZodObject) {}

    transform(value: unknown) {
        const result = this.schema.safeParse(value);

        if (!result.success) {
            throw new BadRequestException(result.error.issues[0].message);
        }

        return result.data;
    }
}
