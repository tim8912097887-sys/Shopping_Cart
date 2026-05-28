import { Injectable } from "@nestjs/common";

import { CategoryRepository } from "./category.repository.js";
import { CategoryNotFoundError } from "./category.error.js";
import { PublicCategoryDto } from "./category.dto.js";

import { logger } from "#configs/logger.js";

import { CategoryTree } from "./interfaces/category.interface.js";

import { withTrace } from "#observability/tracing/tracer-wrapper.js";

@Injectable()
export class CategoryQueryService {
    constructor(private readonly categoryRepo: CategoryRepository) {}

    // =====================================================
    // ADMIN
    // =====================================================

    async findAdminAll() {
        return withTrace(
            {
                name: "category.query.admin_all",

                attributes: {
                    "category.scope": "admin",
                },
            },
            async (span) => {
                logger.info({
                    event: "category_admin_find_all_started",
                });

                try {
                    const categories = await this.categoryRepo.findRoots();

                    span.setAttribute("category.count", categories.length);

                    logger.info({
                        event: "category_admin_find_all_success",

                        count: categories.length,
                    });

                    return categories;
                } catch (error) {
                    logger.error({
                        event: "category_admin_find_all_failed",

                        error,
                    });

                    throw error;
                }
            },
        );
    }

    async findAdminOne(id: string) {
        return withTrace(
            {
                name: "category.query.admin_one",

                attributes: {
                    "category.id": id,
                    "category.scope": "admin",
                },
            },
            async (span) => {
                logger.info({
                    event: "category_admin_find_one_started",
                    categoryId: id,
                });

                try {
                    const category = await this.categoryRepo.findById(id);

                    if (!category) {
                        span.addEvent("category_not_found");

                        logger.warn({
                            event: "category_admin_not_found",

                            categoryId: id,
                        });

                        throw new CategoryNotFoundError(id);
                    }

                    logger.info({
                        event: "category_admin_find_one_success",

                        categoryId: id,
                    });

                    return category;
                } catch (error) {
                    logger.error({
                        event: "category_admin_find_one_failed",

                        categoryId: id,
                        error,
                    });

                    throw error;
                }
            },
        );
    }

    // =====================================================
    // PUBLIC
    // =====================================================

    async findPublicAll() {
        return withTrace(
            {
                name: "category.query.public_all",

                attributes: {
                    "category.scope": "public",
                },
            },
            async (span) => {
                logger.info({
                    event: "category_public_find_all_started",
                });

                try {
                    const categories =
                        await this.categoryRepo.findActiveRoots();

                    span.setAttribute("category.count", categories.length);

                    logger.info({
                        event: "category_public_find_all_success",

                        count: categories.length,
                    });

                    return PublicCategoryDto.toPublicCategoryDtos(categories);
                } catch (error) {
                    logger.error({
                        event: "category_public_find_all_failed",

                        error,
                    });

                    throw error;
                }
            },
        );
    }

    async findPublicOne(slug: string) {
        return withTrace(
            {
                name: "category.query.public_one",

                attributes: {
                    "category.slug": slug,
                    "category.scope": "public",
                },
            },
            async (span) => {
                logger.info({
                    event: "category_public_find_one_started",

                    slug,
                });

                try {
                    const category =
                        await this.categoryRepo.findActiveBySlug(slug);

                    if (!category) {
                        span.addEvent("category_not_found");

                        logger.warn({
                            event: "category_public_not_found",

                            slug,
                        });

                        throw new CategoryNotFoundError(slug);
                    }

                    span.setAttribute("category.id", category.id);

                    logger.info({
                        event: "category_public_find_one_success",

                        slug,
                    });

                    return PublicCategoryDto.toPublicCategoryDto(category);
                } catch (error) {
                    logger.error({
                        event: "category_public_find_one_failed",

                        slug,
                        error,
                    });

                    throw error;
                }
            },
        );
    }

    async findPublicChildren(slug: string) {
        return withTrace(
            {
                name: "category.query.public_children",

                attributes: {
                    "category.slug": slug,
                    "category.scope": "public",
                },
            },
            async (span) => {
                logger.info({
                    event: "category_public_find_children_started",

                    slug,
                });

                try {
                    const parent =
                        await this.categoryRepo.findActiveBySlug(slug);

                    if (!parent) {
                        span.addEvent("category_parent_not_found");

                        logger.warn({
                            event: "category_public_parent_not_found",

                            slug,
                        });

                        throw new CategoryNotFoundError(slug);
                    }

                    span.setAttribute("category.parent_id", parent.id);

                    const children =
                        await this.categoryRepo.findActiveChildrenByParentId(
                            parent.id,
                        );

                    span.setAttribute("category.count", children.length);

                    logger.info({
                        event: "category_public_find_children_success",

                        slug,
                        count: children.length,
                    });

                    return PublicCategoryDto.toPublicCategoryDtos(children);
                } catch (error) {
                    logger.error({
                        event: "category_public_find_children_failed",

                        slug,
                        error,
                    });

                    throw error;
                }
            },
        );
    }

    async findPublicTree(): Promise<CategoryTree[]> {
        return withTrace(
            {
                name: "category.query.public_tree",

                attributes: {
                    "category.scope": "public",
                },
            },
            async (span) => {
                logger.info({
                    event: "category_public_find_tree_started",
                });

                try {
                    const categories = await this.categoryRepo.findAllActive();

                    span.setAttribute(
                        "category.total_count",
                        categories.length,
                    );

                    const categoryMap = new Map<string, CategoryTree>();

                    // -------------------------------------
                    // BUILD TREE
                    // -------------------------------------

                    for (const category of categories) {
                        categoryMap.set(category.id, {
                            ...PublicCategoryDto.toPublicCategoryDto(category),
                            children: [],
                        });
                    }

                    const roots: CategoryTree[] = [];

                    for (const category of categories) {
                        const node = categoryMap.get(
                            category.id,
                        ) as CategoryTree;

                        if (!category.parentId) {
                            roots.push(node);
                            continue;
                        }

                        const parent = categoryMap.get(category.parentId);

                        if (parent) {
                            parent.children.push(node);
                        }
                    }

                    span.setAttribute("category.root_count", roots.length);

                    logger.info({
                        event: "category_public_find_tree_success",

                        count: roots.length,
                    });

                    return roots;
                } catch (error) {
                    logger.error({
                        event: "category_public_find_tree_failed",

                        error,
                    });

                    throw error;
                }
            },
        );
    }
}
