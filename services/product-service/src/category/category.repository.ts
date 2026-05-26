import { Injectable } from "@nestjs/common";
import { Prisma, Category } from "../generated/prisma/client.js";
import { PrismaService } from "#infrastructure/db/prisma.service.js";

@Injectable()
export class CategoryRepository {
    constructor(private readonly prisma: PrismaService) {}

    async create(
        data: Prisma.CategoryCreateInput & { parentId: string | null },
    ): Promise<Category> {
        return this.prisma.client.category.create({
            data: {
                name: data.name,
                slug: data.slug,
                description: data.description,
                isActive: data.isActive ?? true,
                parent: data.parentId
                    ? {
                          connect: { id: data.parentId },
                      }
                    : undefined,
            },
        });
    }

    async findById(id: string): Promise<Category | null> {
        return this.prisma.client.category.findUnique({
            where: { id },
        });
    }

    async findBySlug(
        slug: string,
        parentId?: string | null,
    ): Promise<Category | null> {
        return this.prisma.client.category.findFirst({
            where: {
                slug,
                parentId,
                deletedAt: null,
            },
        });
    }

    async findChildren(parentId: string): Promise<Category[]> {
        return this.prisma.client.category.findMany({
            where: {
                parentId,
                deletedAt: null,
            },
            orderBy: {
                createdAt: "asc",
            },
        });
    }

    async findRoots(): Promise<Category[]> {
        return this.prisma.client.category.findMany({
            where: {
                parentId: null,
                deletedAt: null,
            },
            orderBy: {
                createdAt: "asc",
            },
        });
    }

    async update(
        id: string,
        data: Prisma.CategoryUpdateInput,
    ): Promise<Category> {
        return this.prisma.client.category.update({
            where: { id },
            data,
        });
    }

    async softDelete(id: string): Promise<Category> {
        return this.prisma.client.category.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                isActive: false,
            },
        });
    }
}
