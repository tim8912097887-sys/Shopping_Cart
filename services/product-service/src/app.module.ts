import "reflect-metadata";
import { Module } from "@nestjs/common";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { CategoryModule } from "./category/category.module.js";
import { ConfigModule } from "@nestjs/config";
import { CommonModule } from "#common/common.module.js";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ".env.dev", // or .env
        }),
        CategoryModule,
        CommonModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
