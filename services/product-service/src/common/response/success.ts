import type { AppSuccess } from "./types.js";

export function successResponse<T>(data: T): AppSuccess<T> {
    return {
        state: "success",
        data,
        error: null,
        meta: {
            timestamp: new Date().toISOString(),
        },
    };
}
