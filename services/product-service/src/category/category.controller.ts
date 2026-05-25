import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    UseGuards,
} from "@nestjs/common";
import { CategoryService } from "./category.service.js";
import {
    createCategorySchema,
    type CreateCategoryDto,
} from "./schemas/create-category.schema.js";
import {
    updateCategorySchema,
    type UpdateCategoryDto,
} from "./schemas/update-category.schema.js";
import { ZodValidationPipe } from "#common/pipes/zod-validation.pipe.js";
import {
    type CategoryIdDto,
    categoryIdSchema,
} from "./schemas/category-id.schema.js";
import { successResponse } from "#common/response/success.js";
import { JwtAuthGuard } from "#auth/jwt-auth.guard.js";
import { RolesGuard } from "#auth/roles.guard.js";
import { Roles } from "#auth/roles.decorator.js";

@Controller("admin/categories")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class CategoryController {
    constructor(private readonly categoryService: CategoryService) {}

    @Get()
    async findAll() {
        const categories = await this.categoryService.findAll();
        const data = {
            categories,
            message: "Categories fetched successfully",
        };
        return successResponse(data);
    }

    @Get(":id")
    async findOne(
        @Param(new ZodValidationPipe(categoryIdSchema))
        params: CategoryIdDto,
    ) {
        const category = await this.categoryService.findOne(params.id);
        const data = { category, message: "Category fetched successfully" };
        return successResponse(data);
    }

    @Post()
    async create(
        @Body(new ZodValidationPipe(createCategorySchema))
        dto: CreateCategoryDto,
    ) {
        const category = await this.categoryService.create(dto);
        const data = { category, message: "Category created successfully" };
        return successResponse(data);
    }

    @Patch(":id")
    async update(
        @Param(new ZodValidationPipe(categoryIdSchema))
        params: CategoryIdDto,
        @Body(new ZodValidationPipe(updateCategorySchema))
        dto: UpdateCategoryDto,
    ) {
        const category = await this.categoryService.update(params.id, dto);
        const data = { category, message: "Category updated successfully" };
        return successResponse(data);
    }

    @Delete(":id")
    async remove(
        @Param(new ZodValidationPipe(categoryIdSchema))
        params: CategoryIdDto,
    ) {
        await this.categoryService.remove(params.id);
        const data = { message: "Category deleted successfully" };
        return successResponse(data);
    }
}
