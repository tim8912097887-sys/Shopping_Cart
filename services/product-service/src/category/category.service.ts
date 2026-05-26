import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";

import { CategoryRepository } from "./category.repository.js";
import {
    CategoryAlreadyInactiveError,
    CategoryNotFoundError,
    CategorySelfParentError,
    CategorySlugAlreadyExistsError,
    ParentCategoryNotFoundError,
} from "./category.error.js";

import { CreateCategoryDto } from "./schemas/create-category.schema.js";
import { UpdateCategoryDto } from "./schemas/update-category.schema.js";

import { logger } from "#configs/logger.js";

@Injectable()
export class CategoryService {
    constructor(private readonly categoryRepo: CategoryRepository) {}

    // GET /admin/categories
    async findAll() {
        logger.info({
            event: "category_find_all_started",
        });

        try {
            const categories = await this.categoryRepo.findRoots();

            logger.info({
                event: "category_find_all_success",
                count: categories.length,
            });

            return categories;
        } catch (error) {
            logger.error({
                event: "category_find_all_failed",
                error,
            });
            throw error;
        }
    }

    // GET /admin/categories/:id
    async findOne(id: string) {
        logger.info({
            event: "category_find_one_started",
            categoryId: id,
        });

        try {
            const category = await this.categoryRepo.findById(id);

            if (!category) {
                logger.warn({
                    event: "category_not_found",
                    categoryId: id,
                });

                throw new CategoryNotFoundError(id);
            }

            logger.info({
                event: "category_find_one_success",
                categoryId: id,
            });

            return category;
        } catch (error) {
            logger.error({
                event: "category_find_one_failed",
                categoryId: id,
                error,
            });
            throw error;
        }
    }

    // POST /admin/categories
    async create(dto: CreateCategoryDto) {
        logger.info({
            event: "category_create_started",
            slug: dto.slug,
            parentId: dto.parentId ?? null,
        });

        try {
            // slug uniqueness
            const existingSlug = await this.categoryRepo.findBySlug(
                dto.slug,
                dto.parentId ?? null,
            );

            if (existingSlug) {
                logger.warn({
                    event: "category_slug_conflict",
                    slug: dto.slug,
                    parentId: dto.parentId ?? null,
                });

                throw new CategorySlugAlreadyExistsError(dto.slug);
            }

            // parent validation
            if (dto.parentId) {
                const parent = await this.categoryRepo.findById(dto.parentId);

                if (!parent) {
                    logger.warn({
                        event: "parent_category_not_found",
                        parentId: dto.parentId,
                    });

                    throw new ParentCategoryNotFoundError(dto.parentId);
                }
            }

            const category = await this.categoryRepo.create({
                id: randomUUID(),
                name: dto.name,
                slug: dto.slug,
                description: dto.description,
                parentId: dto.parentId ?? null,
                isActive: dto.isActive ?? true,
            });

            logger.info({
                event: "category_create_success",
                categoryId: category.id,
                slug: category.slug,
            });

            return category;
        } catch (error) {
            logger.error({
                event: "category_create_failed",
                slug: dto.slug,
                error,
            });
            throw error;
        }
    }

    // PATCH /admin/categories/:id
    async update(id: string, dto: UpdateCategoryDto) {
        logger.info({
            event: "category_update_started",
            categoryId: id,
        });

        try {
            const category = await this.categoryRepo.findById(id);

            if (!category) {
                logger.warn({
                    event: "category_not_found",
                    categoryId: id,
                });

                throw new CategoryNotFoundError(id);
            }

            // self-parent
            if (dto.parentId && dto.parentId === id) {
                logger.warn({
                    event: "category_self_parent_attempt",
                    categoryId: id,
                });

                throw new CategorySelfParentError(id);
            }

            // parent validation
            if (dto.parentId) {
                const parent = await this.categoryRepo.findById(dto.parentId);

                if (!parent) {
                    logger.warn({
                        event: "parent_category_not_found",
                        parentId: dto.parentId,
                    });

                    throw new ParentCategoryNotFoundError(dto.parentId);
                }
            }

            // slug conflict
            if (dto.slug) {
                const slugExists = await this.categoryRepo.findBySlug(
                    dto.slug,
                    dto.parentId ?? category.parentId,
                );

                if (slugExists && slugExists.id !== id) {
                    logger.warn({
                        event: "category_slug_conflict",
                        categoryId: id,
                        slug: dto.slug,
                    });

                    throw new CategorySlugAlreadyExistsError(dto.slug);
                }
            }

            const updated = await this.categoryRepo.update(id, dto);

            logger.info({
                event: "category_update_success",
                categoryId: id,
            });

            return updated;
        } catch (error) {
            logger.error({
                event: "category_update_failed",
                categoryId: id,
                error,
            });
            throw error;
        }
    }

    // DELETE /admin/categories/:id
    async remove(id: string) {
        logger.info({
            event: "category_delete_started",
            categoryId: id,
        });

        try {
            const category = await this.categoryRepo.findById(id);

            if (!category) {
                logger.warn({
                    event: "category_not_found",
                    categoryId: id,
                });

                throw new CategoryNotFoundError(id);
            }

            if (!category.isActive) {
                logger.warn({
                    event: "category_already_inactive",
                    categoryId: id,
                });

                throw new CategoryAlreadyInactiveError(id);
            }

            const deleted = await this.categoryRepo.softDelete(id);

            logger.info({
                event: "category_soft_delete_success",
                categoryId: id,
            });

            return deleted;
        } catch (error) {
            logger.error({
                event: "category_delete_failed",
                categoryId: id,
                error,
            });
            throw error;
        }
    }
}
