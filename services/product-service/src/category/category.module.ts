import { Module } from "@nestjs/common";
import { CategoryController } from "./category.controller.js";
import { CategoryService } from "./category.service.js";
import { CategoryRepository } from "./category.repository.js";
import { DatabaseModule } from "#infrastructure/db/database.module.js";
import { AuthModule } from "#auth/auth.module.js";

@Module({
    imports: [DatabaseModule, AuthModule],
    controllers: [CategoryController],
    providers: [CategoryService, CategoryRepository],
})
export class CategoryModule {}
