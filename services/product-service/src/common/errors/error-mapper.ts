import { HttpStatus } from "@nestjs/common";
import { DomainError } from "./domain.js";
import {
    CategoryNotFoundError,
    CategorySlugAlreadyExistsError,
    CategoryAlreadyInactiveError,
    ParentCategoryNotFoundError,
    CategoryCircularHierarchyError,
    CategorySelfParentError,
    CategoryHasChildrenError,
} from "#category/category.error.js";

export type ErrorMapping = {
    status: number;
    code: string;
    message: string;
};

export function mapDomainError(error: DomainError): ErrorMapping {
    switch (true) {
        case error instanceof CategoryNotFoundError:
            return {
                status: HttpStatus.NOT_FOUND,
                code: error.code,
                message: error.message,
            };

        case error instanceof CategorySlugAlreadyExistsError:
            return {
                status: HttpStatus.CONFLICT,
                code: error.code,
                message: error.message,
            };

        case error instanceof CategoryAlreadyInactiveError:
            return {
                status: HttpStatus.CONFLICT,
                code: error.code,
                message: error.message,
            };

        case error instanceof ParentCategoryNotFoundError:
            return {
                status: HttpStatus.BAD_REQUEST,
                code: error.code,
                message: error.message,
            };

        case error instanceof CategorySelfParentError:
        case error instanceof CategoryCircularHierarchyError:
        case error instanceof CategoryHasChildrenError:
            return {
                status: HttpStatus.BAD_REQUEST,
                code: error.code,
                message: error.message,
            };

        default:
            return {
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                code: "INTERNAL_ERROR",
                message: "Internal server error",
            };
    }
}
