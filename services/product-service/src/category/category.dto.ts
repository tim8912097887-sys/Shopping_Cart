import { PublicCategory } from "./interfaces/category.interface.js";

export class PublicCategoryDto {
    public readonly id: string;
    public readonly name: string;
    public readonly slug: string;
    public readonly description: string | null;

    private constructor(category: PublicCategory) {
        this.id = category.id;
        this.name = category.name;
        this.slug = category.slug;
        this.description = category.description;
    }

    public static toPublicCategoryDto(
        category: PublicCategory,
    ): PublicCategoryDto {
        return new PublicCategoryDto(category);
    }

    public static toPublicCategoryDtos(
        categories: PublicCategory[],
    ): PublicCategoryDto[] {
        return categories.map((category) => new PublicCategoryDto(category));
    }
}
