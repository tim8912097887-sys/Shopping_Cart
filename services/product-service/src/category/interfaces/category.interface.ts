export interface Category {
    id: string;
    name: string;
    slug: string;
    description: string | undefined;
    parentId?: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
