export interface Category {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    parentId?: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface PublicCategory {
    id: string;
    name: string;
    slug: string;
    description: string | null;
}

export interface CategoryTree extends PublicCategory {
    children: CategoryTree[];
}
