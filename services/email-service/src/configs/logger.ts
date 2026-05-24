import { createLogger } from "@shoppingcart/logger";

export const logger = createLogger("email-service");

logger.info({
    event: "logger_initialized",
    service: "email-service",
});
