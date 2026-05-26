import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { prisma } from "./prisma.client.js";

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
    async onModuleInit() {
        await prisma.$connect();
    }

    async onModuleDestroy() {
        await prisma.$disconnect();
    }

    get client() {
        return prisma;
    }
}
