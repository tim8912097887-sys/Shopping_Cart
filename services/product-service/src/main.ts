import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { env } from "./configs/env.js";
import { AllExceptionsFilter } from "#common/filters/all-exceptions.filter.js";

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(env.PORT);
}
bootstrap();
