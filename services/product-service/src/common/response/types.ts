export type AppSuccess<T> = {
    state: "success";
    data: T;
    error: null;
    meta: {
        timestamp: string;
    };
};

export type AppError = {
    state: "error";
    data: null;
    error: {
        code: string;
        detail: string;
    };
    meta: {
        timestamp: string;
    };
};

export type AppResponse<T> = AppSuccess<T> | AppError;
