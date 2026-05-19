import { createLogger } from '@shoppingcart/logger';

export const logger = createLogger('user-service');

logger.info({
    event: 'logger_initialized',
    service: 'user-service',
});
