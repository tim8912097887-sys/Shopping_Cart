import { createLogger } from "@shoppingcart/logger";

export const logger = createLogger("product-service");

logger.info({
    event: "logger_initialized",
    service: "product-service",
});
