import { describe, expect, it, beforeEach, vi, Mocked } from "vitest";

import { CategoryService } from "../../category/category.service.js";
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
    let service: CategoryService;

    beforeEach(() => {
        mockRepo = {
            findRoots: vi.fn(),
            findById: vi.fn(),
            findBySlug: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            softDelete: vi.fn(),
            findChildren: vi.fn(),
        } as unknown as Mocked<CategoryRepository>;

        service = new CategoryService(
            mockRepo as unknown as CategoryRepository,
        );
    });

    describe("findAll", () => {
        it("returns all root categories", async () => {
            const categories = [
                makeCategory(),
                makeCategory({ id: "other-id", slug: "other" }),
            ];
            mockRepo.findRoots.mockResolvedValue(categories);

            const result = await service.findAll();

            expect(result).toEqual(categories);
            expect(mockRepo.findRoots).toHaveBeenCalledOnce();
        });
    });

    describe("findOne", () => {
        it("returns a category when it exists", async () => {
            const category = makeCategory();
            mockRepo.findById.mockResolvedValue(category);

            const result = await service.findOne(category.id);

            expect(result).toEqual(category);
            expect(mockRepo.findById).toHaveBeenCalledWith(category.id);
        });

        it("throws CategoryNotFoundError when category is missing", async () => {
            mockRepo.findById.mockResolvedValue(null);

            await expect(service.findOne("missing-id")).rejects.toBeInstanceOf(
                CategoryNotFoundError,
            );
            expect(mockRepo.findById).toHaveBeenCalledWith("missing-id");
        });
    });

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

            const result = await service.create(dto);

            expect(result).toEqual(created);
            expect(mockRepo.findBySlug).toHaveBeenCalledWith(dto.slug, null);
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

            const result = await service.create(dto);

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

            await expect(service.create(dto)).rejects.toBeInstanceOf(
                CategorySlugAlreadyExistsError,
            );
            expect(mockRepo.findBySlug).toHaveBeenCalledWith(dto.slug, null);
            expect(mockRepo.create).not.toHaveBeenCalled();
        });

        it("throws ParentCategoryNotFoundError when parent does not exist", async () => {
            const dto = makeCreateDto({ parentId: "missing-parent" });

            mockRepo.findBySlug.mockResolvedValue(null);
            mockRepo.findById.mockResolvedValue(null);

            await expect(service.create(dto)).rejects.toBeInstanceOf(
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
            const dto = makeUpdateDto({ description: "Updated description" });
            const updated = { ...category, ...dto };

            mockRepo.findById.mockResolvedValue(category);
            mockRepo.findBySlug.mockResolvedValue(null);
            mockRepo.update.mockResolvedValue(updated);

            const result = await service.update(category.id, dto);

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

            const result = await service.update(category.id, dto);

            expect(result).toEqual({ ...category, ...dto });
            expect(mockRepo.update).toHaveBeenCalledWith(category.id, dto);
        });

        it("throws CategoryNotFoundError when the category cannot be found", async () => {
            mockRepo.findById.mockResolvedValue(null);

            await expect(
                service.update("missing-id", makeUpdateDto()),
            ).rejects.toBeInstanceOf(CategoryNotFoundError);
            expect(mockRepo.update).not.toHaveBeenCalled();
        });

        it("throws CategorySelfParentError when category parentId matches its own id", async () => {
            const category = makeCategory();
            const dto = makeUpdateDto({ parentId: category.id });

            mockRepo.findById.mockResolvedValue(category);

            await expect(
                service.update(category.id, dto),
            ).rejects.toBeInstanceOf(CategorySelfParentError);
            expect(mockRepo.update).not.toHaveBeenCalled();
        });

        it("throws ParentCategoryNotFoundError when the requested parent does not exist", async () => {
            const category = makeCategory();
            const dto = makeUpdateDto({ parentId: "missing-parent" });

            mockRepo.findById.mockResolvedValueOnce(category);
            mockRepo.findById.mockResolvedValueOnce(null);

            await expect(
                service.update(category.id, dto),
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
                service.update(category.id, dto),
            ).rejects.toBeInstanceOf(CategorySlugAlreadyExistsError);
            expect(mockRepo.update).not.toHaveBeenCalled();
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

            const result = await service.remove(category.id);

            expect(result).toEqual(deleted);
            expect(mockRepo.findById).toHaveBeenCalledWith(category.id);
            expect(mockRepo.softDelete).toHaveBeenCalledWith(category.id);
        });

        it("throws CategoryNotFoundError when category does not exist", async () => {
            mockRepo.findById.mockResolvedValue(null);

            await expect(service.remove("missing-id")).rejects.toBeInstanceOf(
                CategoryNotFoundError,
            );
            expect(mockRepo.softDelete).not.toHaveBeenCalled();
        });

        it("throws CategoryAlreadyInactiveError when category is already inactive", async () => {
            const category = makeCategory({ isActive: false });
            mockRepo.findById.mockResolvedValue(category);

            await expect(service.remove(category.id)).rejects.toBeInstanceOf(
                CategoryAlreadyInactiveError,
            );
            expect(mockRepo.softDelete).not.toHaveBeenCalled();
        });
    });
});
