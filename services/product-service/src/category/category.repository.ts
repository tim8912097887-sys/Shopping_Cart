import { Injectable } from "@nestjs/common";
import { Prisma, Category } from "../generated/prisma/client.js";
import { PrismaService } from "#infrastructure/db/prisma.service.js";
import { InjectMetric } from "@willsoto/nestjs-prometheus";
import { MetricsService } from "#monitoring/metrics.service.js";
import { Histogram } from "prom-client";

@Injectable()
export class CategoryRepository {
    constructor(
        private readonly prisma: PrismaService,

        private readonly metrics: MetricsService,

        @InjectMetric("category_repository_operation_duration_seconds")
        private readonly dbHistogram: Histogram<string>,
    ) {}

    async create(
        data: Prisma.CategoryCreateInput & { parentId: string | null },
    ): Promise<Category> {
        return this.metrics.trackDuration(
            this.dbHistogram,
            { operation: "create" },
            () =>
                this.prisma.client.category.create({
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
                }),
        );
    }

    async findById(id: string): Promise<Category | null> {
        return this.metrics.trackDuration(
            this.dbHistogram,
            { operation: "findById" },
            () =>
                this.prisma.client.category.findUnique({
                    where: { id },
                }),
        );
    }

    async findBySlug(
        slug: string,
        parentId?: string | null,
    ): Promise<Category | null> {
        return this.metrics.trackDuration(
            this.dbHistogram,
            { operation: "findBySlug" },
            () =>
                this.prisma.client.category.findFirst({
                    where: {
                        slug,
                        parentId,
                        deletedAt: null,
                    },
                }),
        );
    }

    async findChildren(parentId: string): Promise<Category[]> {
        return this.metrics.trackDuration(
            this.dbHistogram,
            { operation: "findChildren" },
            () =>
                this.prisma.client.category.findMany({
                    where: {
                        parentId,
                        deletedAt: null,
                    },
                    orderBy: {
                        createdAt: "asc",
                    },
                }),
        );
    }

    async findRoots(): Promise<Category[]> {
        return this.metrics.trackDuration(
            this.dbHistogram,
            { operation: "findRoots" },
            () =>
                this.prisma.client.category.findMany({
                    where: {
                        parentId: null,
                        deletedAt: null,
                    },
                    orderBy: {
                        createdAt: "asc",
                    },
                }),
        );
    }

    async update(
        id: string,
        data: Prisma.CategoryUpdateInput,
    ): Promise<Category> {
        return this.metrics.trackDuration(
            this.dbHistogram,
            { operation: "update" },
            () =>
                this.prisma.client.category.update({
                    where: { id },
                    data,
                }),
        );
    }

    async softDelete(id: string): Promise<Category> {
        return this.metrics.trackDuration(
            this.dbHistogram,
            { operation: "softDelete" },
            () =>
                this.prisma.client.category.update({
                    where: { id },
                    data: {
                        deletedAt: new Date(),
                        isActive: false,
                    },
                }),
        );
    }

    async findActiveRoots(): Promise<Category[]> {
        return this.metrics.trackDuration(
            this.dbHistogram,
            { operation: "findActiveRoots" },
            () =>
                this.prisma.client.category.findMany({
                    where: {
                        parentId: null,
                        isActive: true,
                        deletedAt: null,
                    },
                    orderBy: {
                        createdAt: "asc",
                    },
                }),
        );
    }

    async findActiveBySlug(slug: string): Promise<Category | null> {
        return this.metrics.trackDuration(
            this.dbHistogram,
            { operation: "findActiveBySlug" },
            () =>
                this.prisma.client.category.findFirst({
                    where: {
                        slug,
                        isActive: true,
                        deletedAt: null,
                    },
                }),
        );
    }

    async findActiveChildrenByParentId(parentId: string): Promise<Category[]> {
        return this.metrics.trackDuration(
            this.dbHistogram,
            { operation: "findActiveChildrenByParentId" },
            () =>
                this.prisma.client.category.findMany({
                    where: {
                        parentId,
                        isActive: true,
                        deletedAt: null,
                    },
                    orderBy: {
                        createdAt: "asc",
                    },
                }),
        );
    }

    async findAllActive(): Promise<Category[]> {
        return this.metrics.trackDuration(
            this.dbHistogram,
            { operation: "findAllActive" },
            () =>
                this.prisma.client.category.findMany({
                    where: {
                        isActive: true,
                        deletedAt: null,
                    },
                    orderBy: {
                        createdAt: "asc",
                    },
                }),
        );
    }
}
