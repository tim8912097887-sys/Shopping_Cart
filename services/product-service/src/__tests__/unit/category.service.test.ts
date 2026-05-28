import { describe, expect, it, beforeEach, vi, Mocked } from "vitest";
import type { Counter } from "prom-client";

import { CategoryCommandService } from "../../category/category-command.service.js";
import { CategoryQueryService } from "../../category/category-query.service.js";
import { CategoryRepository } from "../../category/category.repository.js";
import {
    CategoryAlreadyInactiveError,
    CategoryNotFoundError,
    CategorySelfParentError,
    CategorySlugAlreadyExistsError,
    ParentCategoryNotFoundError,
} from "../../category/category.error.js";

const makeCategory = (overrides: Record<string, any> = {}) => ({
    id: "category-id",
    name: "Electronics",
    slug: "electronics",
    description: "Devices and gadgets",
    parentId: null,
    isActive: true,
    deletedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
});

const makeCreateDto = (overrides: Record<string, any> = {}) => ({
    name: "New Category",
    slug: "new-category",
    description: "Category description",
    parentId: null,
    ...overrides,
});

const makeUpdateDto = (overrides: Record<string, any> = {}) => ({
    name: "Updated Category",
    slug: "updated-category",
    description: "Updated description",
    parentId: null,
    isActive: true,
    ...overrides,
});

describe("Category Service", () => {
    let mockRepo: Mocked<CategoryRepository>;
    let mockValidationCounter: Mocked<Counter<string>>;
    let commandService: CategoryCommandService;
    let queryService: CategoryQueryService;

    beforeEach(() => {
        mockRepo = {
            findRoots: vi.fn(),
            findById: vi.fn(),
            findBySlug: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            softDelete: vi.fn(),
            findActiveRoots: vi.fn(),
            findActiveBySlug: vi.fn(),
            findActiveChildrenByParentId: vi.fn(),
            findAllActive: vi.fn(),
        } as unknown as Mocked<CategoryRepository>;

        mockValidationCounter = {
            inc: vi.fn(),
        } as unknown as Mocked<Counter<string>>;

        commandService = new CategoryCommandService(
            mockRepo as unknown as CategoryRepository,
            mockValidationCounter as unknown as Counter<string>,
        );

        queryService = new CategoryQueryService(
            mockRepo as unknown as CategoryRepository,
        );
    });

    describe("Admin Query (findAdminAll / findAdminOne)", () => {
        it("returns all root categories", async () => {
            const categories = [
                makeCategory(),
                makeCategory({ id: "other-id", slug: "other" }),
            ];
            mockRepo.findRoots.mockResolvedValue(categories);

            const result = await queryService.findAdminAll();

            expect(result).toEqual(categories);
            expect(mockRepo.findRoots).toHaveBeenCalledOnce();
        });

        it("returns a category when it exists", async () => {
            const category = makeCategory();
            mockRepo.findById.mockResolvedValue(category);

            const result = await queryService.findAdminOne(category.id);

            expect(result).toEqual(category);
            expect(mockRepo.findById).toHaveBeenCalledWith(category.id);
        });

        it("throws CategoryNotFoundError when category is missing", async () => {
            mockRepo.findById.mockResolvedValue(null);

            await expect(
                queryService.findAdminOne("missing-id"),
            ).rejects.toBeInstanceOf(CategoryNotFoundError);
            expect(mockRepo.findById).toHaveBeenCalledWith("missing-id");
        });
    });

    describe("Command (create / update / remove)", () => {
        describe("create", () => {
            it("creates a new root category when slug is unique", async () => {
                const dto = makeCreateDto();
                const created = makeCategory({
                    name: dto.name,
                    slug: dto.slug,
                    parentId: null,
                });

                mockRepo.findBySlug.mockResolvedValue(null);
                mockRepo.create.mockResolvedValue(created);

                const result = await commandService.create(dto);

                expect(result).toEqual(created);
                expect(mockRepo.findBySlug).toHaveBeenCalledWith(
                    dto.slug,
                    null,
                );
                expect(mockRepo.create).toHaveBeenCalledWith(
                    expect.objectContaining({
                        name: dto.name,
                        slug: dto.slug,
                        parentId: null,
                        isActive: true,
                    }),
                );
            });

            it("creates a new child category when parent exists", async () => {
                const parent = makeCategory({ id: "parent-id" });
                const dto = makeCreateDto({ parentId: parent.id });
                const created = makeCategory({
                    parentId: parent.id,
                    slug: dto.slug,
                });

                mockRepo.findBySlug.mockResolvedValue(null);
                mockRepo.findById.mockResolvedValue(parent);
                mockRepo.create.mockResolvedValue(created);

                const result = await commandService.create(dto);

                expect(result).toEqual(created);
                expect(mockRepo.findBySlug).toHaveBeenCalledWith(
                    dto.slug,
                    parent.id,
                );
                expect(mockRepo.findById).toHaveBeenCalledWith(parent.id);
            });

            it("throws CategorySlugAlreadyExistsError when slug is already in use", async () => {
                const dto = makeCreateDto();
                mockRepo.findBySlug.mockResolvedValue(
                    makeCategory({ id: "existing-id" }),
                );

                await expect(commandService.create(dto)).rejects.toBeInstanceOf(
                    CategorySlugAlreadyExistsError,
                );
                expect(mockRepo.findBySlug).toHaveBeenCalledWith(
                    dto.slug,
                    null,
                );
                expect(mockRepo.create).not.toHaveBeenCalled();
                expect(mockValidationCounter.inc).toHaveBeenCalledWith({
                    reason: "slug_conflict",
                });
            });

            it("throws ParentCategoryNotFoundError when parent does not exist", async () => {
                const dto = makeCreateDto({ parentId: "missing-parent" });

                mockRepo.findBySlug.mockResolvedValue(null);
                mockRepo.findById.mockResolvedValue(null);

                await expect(commandService.create(dto)).rejects.toBeInstanceOf(
                    ParentCategoryNotFoundError,
                );
                expect(mockRepo.findBySlug).toHaveBeenCalledWith(
                    dto.slug,
                    dto.parentId,
                );
                expect(mockRepo.findById).toHaveBeenCalledWith(dto.parentId);
                expect(mockRepo.create).not.toHaveBeenCalled();
            });
        });

        describe("update", () => {
            it("updates an existing category successfully", async () => {
                const category = makeCategory();
                const dto = makeUpdateDto({
                    description: "Updated description",
                });
                const updated = { ...category, ...dto };

                mockRepo.findById.mockResolvedValue(category);
                mockRepo.findBySlug.mockResolvedValue(null);
                mockRepo.update.mockResolvedValue(updated);
                const result = await commandService.update(category.id, dto);

                expect(result).toEqual(updated);
                expect(mockRepo.findById).toHaveBeenCalledWith(category.id);
                expect(mockRepo.findBySlug).toHaveBeenCalledWith(
                    dto.slug,
                    category.parentId,
                );
                expect(mockRepo.update).toHaveBeenCalledWith(category.id, dto);
            });

            it("allows updating a category when the requested slug belongs to the same category", async () => {
                const category = makeCategory();
                const dto = makeUpdateDto({ slug: category.slug });
                mockRepo.findById.mockResolvedValue(category);
                mockRepo.findBySlug.mockResolvedValue(category);
                mockRepo.update.mockResolvedValue({ ...category, ...dto });
                const result = await commandService.update(category.id, dto);

                expect(result).toEqual({ ...category, ...dto });
                expect(mockRepo.update).toHaveBeenCalledWith(category.id, dto);
            });
            it("throws CategoryNotFoundError when the category cannot be found", async () => {
                mockRepo.findById.mockResolvedValue(null);

                await expect(
                    commandService.update("missing-id", makeUpdateDto()),
                ).rejects.toBeInstanceOf(CategoryNotFoundError);
                expect(mockRepo.update).not.toHaveBeenCalled();
            });

            it("throws CategorySelfParentError when category parentId matches its own id", async () => {
                const category = makeCategory();
                const dto = makeUpdateDto({ parentId: category.id });

                mockRepo.findById.mockResolvedValue(category);

                await expect(
                    commandService.update(category.id, dto),
                ).rejects.toBeInstanceOf(CategorySelfParentError);
                expect(mockRepo.update).not.toHaveBeenCalled();
                expect(mockValidationCounter.inc).toHaveBeenCalledWith({
                    reason: "self_parent",
                });
            });

            it("throws ParentCategoryNotFoundError when the requested parent does not exist", async () => {
                const category = makeCategory();
                const dto = makeUpdateDto({ parentId: "missing-parent" });

                mockRepo.findById.mockResolvedValueOnce(category);
                mockRepo.findById.mockResolvedValueOnce(null);

                await expect(
                    commandService.update(category.id, dto),
                ).rejects.toBeInstanceOf(ParentCategoryNotFoundError);
                expect(mockRepo.update).not.toHaveBeenCalled();
            });

            it("throws CategorySlugAlreadyExistsError when slug is used by another category", async () => {
                const category = makeCategory();
                const dto = makeUpdateDto({ slug: "conflicting-slug" });
                const conflicting = makeCategory({
                    id: "other-id",
                    slug: dto.slug,
                });

                mockRepo.findById.mockResolvedValue(category);
                mockRepo.findBySlug.mockResolvedValue(conflicting);

                await expect(
                    commandService.update(category.id, dto),
                ).rejects.toBeInstanceOf(CategorySlugAlreadyExistsError);
                expect(mockRepo.update).not.toHaveBeenCalled();
            });

            it("throws CategoryCircularHierarchyError when parent chain contains the category id", async () => {
                const category = makeCategory({ id: "root-id" });
                const child = makeCategory({
                    id: "child-id",
                    parentId: "root-id",
                });
                const dto = makeUpdateDto({ parentId: "child-id" });

                // first findById returns the category being updated
                mockRepo.findById.mockResolvedValueOnce(category);
                // then findById for parent returns child, and next iteration returns parent whose parentId points back to root-id
                mockRepo.findById.mockResolvedValueOnce(child);
                mockRepo.findById.mockResolvedValueOnce(category);

                const { CategoryCircularHierarchyError } =
                    await import("../../category/category.error.js");

                await expect(
                    commandService.update(category.id, dto),
                ).rejects.toBeInstanceOf(CategoryCircularHierarchyError as any);
                expect(mockRepo.update).not.toHaveBeenCalled();
                expect(mockValidationCounter.inc).toHaveBeenCalledWith({
                    reason: "circular_hierarchy",
                });
            });
        });

        describe("remove", () => {
            it("soft deletes an active category", async () => {
                const category = makeCategory({ isActive: true });
                const deleted = {
                    ...category,
                    isActive: false,
                    deletedAt: new Date(),
                };

                mockRepo.findById.mockResolvedValue(category);
                mockRepo.softDelete.mockResolvedValue(deleted);

                const result = await commandService.remove(category.id);

                expect(result).toEqual(deleted);
                expect(mockRepo.findById).toHaveBeenCalledWith(category.id);
                expect(mockRepo.softDelete).toHaveBeenCalledWith(category.id);
            });

            it("throws CategoryNotFoundError when category does not exist", async () => {
                mockRepo.findById.mockResolvedValue(null);

                await expect(
                    commandService.remove("missing-id"),
                ).rejects.toBeInstanceOf(CategoryNotFoundError);
                expect(mockRepo.softDelete).not.toHaveBeenCalled();
            });

            it("throws CategoryAlreadyInactiveError when category is already inactive", async () => {
                const category = makeCategory({ isActive: false });
                mockRepo.findById.mockResolvedValue(category);

                await expect(
                    commandService.remove(category.id),
                ).rejects.toBeInstanceOf(CategoryAlreadyInactiveError);
                expect(mockRepo.softDelete).not.toHaveBeenCalled();
            });
        });

        describe("Public Query (findPublicAll / findPublicOne / findPublicChildren / findPublicTree)", () => {
            it("findPublicAll returns public DTOs from active roots", async () => {
                const categories = [
                    makeCategory({ id: "a", slug: "a" }),
                    makeCategory({ id: "b", slug: "b" }),
                ];

                mockRepo.findActiveRoots.mockResolvedValue(categories);

                const result = await queryService.findPublicAll();

                expect(result).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({ slug: "a" }),
                    ]),
                );
                expect(mockRepo.findActiveRoots).toHaveBeenCalledOnce();
            });

            it("findPublicOne returns a public dto when found and throws when missing", async () => {
                const category = makeCategory({ id: "pub-id", slug: "pub" });
                mockRepo.findActiveBySlug.mockResolvedValueOnce(category);

                const result = await queryService.findPublicOne(category.slug);

                expect(result).toEqual(
                    expect.objectContaining({ slug: category.slug }),
                );
                expect(mockRepo.findActiveBySlug).toHaveBeenCalledWith(
                    category.slug,
                );

                mockRepo.findActiveBySlug.mockResolvedValueOnce(null);
                await expect(
                    queryService.findPublicOne("missing"),
                ).rejects.toBeInstanceOf(CategoryNotFoundError);
                expect(mockRepo.findActiveBySlug).toHaveBeenCalledWith(
                    "missing",
                );
            });

            it("findPublicChildren returns children DTOs when parent exists and throws when not", async () => {
                const parent = makeCategory({ id: "p", slug: "parent" });
                const children = [makeCategory({ id: "c1", parentId: "p" })];

                mockRepo.findActiveBySlug.mockResolvedValueOnce(parent);
                mockRepo.findActiveChildrenByParentId.mockResolvedValueOnce(
                    children,
                );

                const result = await queryService.findPublicChildren(
                    parent.slug,
                );

                expect(result).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({ id: "c1" }),
                    ]),
                );
                expect(mockRepo.findActiveBySlug).toHaveBeenCalledWith(
                    parent.slug,
                );
                expect(
                    mockRepo.findActiveChildrenByParentId,
                ).toHaveBeenCalledWith(parent.id);

                mockRepo.findActiveBySlug.mockResolvedValueOnce(null);
                await expect(
                    queryService.findPublicChildren("missing"),
                ).rejects.toBeInstanceOf(CategoryNotFoundError);
            });

            it("findPublicTree builds a nested tree of public categories", async () => {
                const root = makeCategory({
                    id: "r",
                    parentId: null,
                    slug: "root",
                });
                const child = makeCategory({
                    id: "c",
                    parentId: "r",
                    slug: "child",
                });
                const orphan = makeCategory({
                    id: "o",
                    parentId: null,
                    slug: "orphan",
                });

                mockRepo.findAllActive.mockResolvedValue([root, child, orphan]);

                const tree = await queryService.findPublicTree();

                expect(mockRepo.findAllActive).toHaveBeenCalledOnce();
                expect(tree).toHaveLength(2);
                const rootNode = tree.find((n: any) => n.id === "r");
                expect(rootNode).toBeDefined();
                expect(rootNode?.children).toHaveLength(1);
                expect(rootNode?.children[0].id).toBe("c");
            });
        });
    });
});
