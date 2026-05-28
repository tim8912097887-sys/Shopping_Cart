import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";

import { InjectMetric } from "@willsoto/nestjs-prometheus";

import { Counter } from "prom-client";

import { CategoryRepository } from "./category.repository.js";

import {
    CategoryAlreadyInactiveError,
    CategoryCircularHierarchyError,
    CategoryNotFoundError,
    CategorySelfParentError,
    CategorySlugAlreadyExistsError,
    ParentCategoryNotFoundError,
} from "./category.error.js";

import { CreateCategoryDto } from "./schemas/create-category.schema.js";
import { UpdateCategoryDto } from "./schemas/update-category.schema.js";

import { logger } from "#configs/logger.js";

import { withTrace } from "#observability/tracing/tracer-wrapper.js";

@Injectable()
export class CategoryCommandService {
    constructor(
        private readonly categoryRepo: CategoryRepository,

        @InjectMetric("category_validation_failures_total")
        private readonly validationCounter: Counter<string>,
    ) {}

    // =====================================================
    // CREATE
    // =====================================================

    async create(dto: CreateCategoryDto) {
        return withTrace(
            {
                name: "category.command.create",

                attributes: {
                    "category.slug": dto.slug,
                    "category.parent_id": dto.parentId ?? "root",
                },
            },
            async (span) => {
                logger.info({
                    event: "category_create_started",

                    slug: dto.slug,

                    parentId: dto.parentId ?? null,
                });

                try {
                    // ---------------------------------
                    // SLUG VALIDATION
                    // ---------------------------------

                    const existingSlug = await this.categoryRepo.findBySlug(
                        dto.slug,
                        dto.parentId ?? null,
                    );

                    if (existingSlug) {
                        span.addEvent("category_slug_conflict");

                        logger.warn({
                            event: "category_slug_conflict",

                            slug: dto.slug,

                            parentId: dto.parentId ?? null,
                        });

                        this.validationCounter.inc({
                            reason: "slug_conflict",
                        });

                        throw new CategorySlugAlreadyExistsError(dto.slug);
                    }

                    // ---------------------------------
                    // PARENT VALIDATION
                    // ---------------------------------

                    if (dto.parentId) {
                        const parent = await this.categoryRepo.findById(
                            dto.parentId,
                        );

                        if (!parent) {
                            span.addEvent("parent_category_not_found");

                            logger.warn({
                                event: "parent_category_not_found",

                                parentId: dto.parentId,
                            });

                            throw new ParentCategoryNotFoundError(dto.parentId);
                        }
                    }

                    // ---------------------------------
                    // CREATE CATEGORY
                    // ---------------------------------

                    const category = await this.categoryRepo.create({
                        id: randomUUID(),

                        name: dto.name,

                        slug: dto.slug,

                        description: dto.description,

                        parentId: dto.parentId ?? null,

                        isActive: dto.isActive ?? true,
                    });

                    span.setAttributes({
                        "category.id": category.id,

                        "category.created": true,
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
            },
        );
    }

    // =====================================================
    // UPDATE
    // =====================================================

    async update(id: string, dto: UpdateCategoryDto) {
        return withTrace(
            {
                name: "category.command.update",

                attributes: {
                    "category.id": id,
                },
            },
            async (span) => {
                logger.info({
                    event: "category_update_started",

                    categoryId: id,
                });

                try {
                    const category = await this.categoryRepo.findById(id);

                    if (!category) {
                        span.addEvent("category_not_found");

                        logger.warn({
                            event: "category_not_found",

                            categoryId: id,
                        });

                        throw new CategoryNotFoundError(id);
                    }

                    // ---------------------------------
                    // SELF PARENT VALIDATION
                    // ---------------------------------

                    if (dto.parentId && dto.parentId === id) {
                        span.addEvent("category_self_parent_attempt");

                        logger.warn({
                            event: "category_self_parent_attempt",

                            categoryId: id,
                        });

                        this.validationCounter.inc({
                            reason: "self_parent",
                        });

                        throw new CategorySelfParentError(id);
                    }

                    // ---------------------------------
                    // PARENT VALIDATION
                    // ---------------------------------

                    if (dto.parentId) {
                        let parent = await this.categoryRepo.findById(
                            dto.parentId,
                        );

                        if (!parent) {
                            span.addEvent("parent_category_not_found");

                            logger.warn({
                                event: "parent_category_not_found",

                                parentId: dto.parentId,
                            });

                            throw new ParentCategoryNotFoundError(dto.parentId);
                        }

                        // -----------------------------
                        // CIRCULAR HIERARCHY CHECK
                        // -----------------------------

                        let depth = 0;

                        while (parent) {
                            depth++;

                            if (parent.id === id) {
                                span.addEvent("category_circular_hierarchy");

                                span.setAttribute(
                                    "category.hierarchy_depth",
                                    depth,
                                );

                                logger.warn({
                                    event: "category_circular_hierarchy",

                                    categoryId: id,

                                    parentId: dto.parentId,
                                });

                                this.validationCounter.inc({
                                    reason: "circular_hierarchy",
                                });

                                throw new CategoryCircularHierarchyError(
                                    id,
                                    dto.parentId,
                                );
                            }

                            if (!parent.parentId) {
                                break;
                            }

                            parent = await this.categoryRepo.findById(
                                parent.parentId,
                            );
                        }
                    }

                    // ---------------------------------
                    // SLUG VALIDATION
                    // ---------------------------------

                    if (dto.slug) {
                        const slugExists = await this.categoryRepo.findBySlug(
                            dto.slug,
                            dto.parentId ?? category.parentId,
                        );

                        if (slugExists && slugExists.id !== id) {
                            span.addEvent("category_slug_conflict");

                            logger.warn({
                                event: "category_slug_conflict",

                                categoryId: id,

                                slug: dto.slug,
                            });

                            this.validationCounter.inc({
                                reason: "slug_conflict",
                            });

                            throw new CategorySlugAlreadyExistsError(dto.slug);
                        }
                    }

                    // ---------------------------------
                    // UPDATE CATEGORY
                    // ---------------------------------

                    const updated = await this.categoryRepo.update(id, dto);

                    span.setAttribute("category.updated", true);

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
            },
        );
    }

    // =====================================================
    // DELETE
    // =====================================================

    async remove(id: string) {
        return withTrace(
            {
                name: "category.command.remove",

                attributes: {
                    "category.id": id,
                },
            },
            async (span) => {
                logger.info({
                    event: "category_delete_started",

                    categoryId: id,
                });

                try {
                    const category = await this.categoryRepo.findById(id);

                    if (!category) {
                        span.addEvent("category_not_found");

                        logger.warn({
                            event: "category_not_found",

                            categoryId: id,
                        });

                        throw new CategoryNotFoundError(id);
                    }

                    if (!category.isActive) {
                        span.addEvent("category_already_inactive");

                        logger.warn({
                            event: "category_already_inactive",

                            categoryId: id,
                        });

                        throw new CategoryAlreadyInactiveError(id);
                    }

                    const deleted = await this.categoryRepo.softDelete(id);

                    span.setAttributes({
                        "category.deleted": true,

                        "category.soft_delete": true,
                    });

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
            },
        );
    }
}
