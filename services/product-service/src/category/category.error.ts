import { DomainError } from "#common/errors/domain.js";

// Category not found
export class CategoryNotFoundError extends DomainError {
    readonly code = "CATEGORY_NOT_FOUND";

    constructor(categoryId: string) {
        super("Category not found", { categoryId });
    }
}

// Duplicate slug
export class CategorySlugAlreadyExistsError extends DomainError {
    readonly code = "CATEGORY_SLUG_ALREADY_EXISTS";

    constructor(slug: string) {
        super("Category slug already exists", { slug });
    }
}

// Duplicate name
export class CategoryNameAlreadyExistsError extends DomainError {
    readonly code = "CATEGORY_NAME_ALREADY_EXISTS";

    constructor(name: string) {
        super("Category name already exists", { name });
    }
}

// Parent category missing
export class ParentCategoryNotFoundError extends DomainError {
    readonly code = "PARENT_CATEGORY_NOT_FOUND";

    constructor(parentId: string) {
        super("Parent category not found", { parentId });
    }
}

// Prevent category being its own parent
export class CategorySelfParentError extends DomainError {
    readonly code = "CATEGORY_SELF_PARENT";

    constructor(categoryId: string) {
        super("Category cannot be its own parent", { categoryId });
    }
}

// Prevent circular tree
export class CategoryCircularHierarchyError extends DomainError {
    readonly code = "CATEGORY_CIRCULAR_HIERARCHY";

    constructor(categoryId: string, parentId: string) {
        super("Circular category hierarchy detected", {
            categoryId,
            parentId,
        });
    }
}

// Already soft deleted
export class CategoryAlreadyInactiveError extends DomainError {
    readonly code = "CATEGORY_ALREADY_INACTIVE";

    constructor(categoryId: string) {
        super("Category is already inactive", { categoryId });
    }
}

// Deleting parent with active children
export class CategoryHasChildrenError extends DomainError {
    readonly code = "CATEGORY_HAS_CHILDREN";

    constructor(categoryId: string) {
        super("Category has child categories", { categoryId });
    }
}
