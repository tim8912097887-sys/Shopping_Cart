import { ERROR_CODE } from "./types.js";
import { ApiError } from "./api.js";

export class TooManyRequestError extends ApiError {
    constructor(message: string) {
        super(ERROR_CODE.TOO_MANY_REQUEST, message, true);
    }
}
