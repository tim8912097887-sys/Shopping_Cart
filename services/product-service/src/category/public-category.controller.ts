import { Controller, Get, Param } from "@nestjs/common";
import { successResponse } from "#common/response/success.js";
import { CategoryQueryService } from "./category-query.service.js";

@Controller("/categories")
export class PublicCategoryController {
    constructor(private readonly categoryQueryService: CategoryQueryService) {}

    // GET /categories
    @Get()
    async findAll() {
        const categories = await this.categoryQueryService.findPublicAll();

        return successResponse({
            categories,
            message: "Categories fetched successfully",
        });
    }

    // GET /categories/tree
    @Get("tree")
    async findTree() {
        const tree = await this.categoryQueryService.findPublicTree();

        return successResponse({
            categories: tree,
            message: "Category tree fetched successfully",
        });
    }

    // GET /categories/:slug
    @Get(":slug")
    async findOne(@Param("slug") slug: string) {
        const category = await this.categoryQueryService.findPublicOne(slug);

        return successResponse({
            category,
            message: "Category fetched successfully",
        });
    }

    // GET /categories/:slug/children
    @Get(":slug/children")
    async findChildren(@Param("slug") slug: string) {
        const categories =
            await this.categoryQueryService.findPublicChildren(slug);

        return successResponse({
            categories,
            message: "Child categories fetched successfully",
        });
    }
}
