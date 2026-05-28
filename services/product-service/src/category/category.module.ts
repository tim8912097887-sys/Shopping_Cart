import { Module } from "@nestjs/common";
import { AdminCategoryController } from "./admin-category.controller.js";
import { CategoryCommandService } from "./category-command.service.js";
import { CategoryRepository } from "./category.repository.js";
import { DatabaseModule } from "#infrastructure/db/database.module.js";
import { AuthModule } from "#auth/auth.module.js";
import { PublicCategoryController } from "./public-category.controller.js";
import { CategoryQueryService } from "./category-query.service.js";
import { MonitoringModule } from "#monitoring/monitoring.module.js";

@Module({
    imports: [DatabaseModule, AuthModule, MonitoringModule],
    controllers: [AdminCategoryController, PublicCategoryController],
    providers: [
        CategoryCommandService,
        CategoryQueryService,
        CategoryRepository,
    ],
})
export class CategoryModule {}
