import type { ILogger } from '@chasenocap/logger';
import type { ICache } from '@chasenocap/cache';
import type { IRateLimitManager } from '../interfaces/IRateLimitManager.js';
import type { RateLimitInfo } from '../types/GitHubTypes.js';
export declare class RateLimitManager implements IRateLimitManager {
    private readonly logger;
    private readonly cache;
    private readonly cachePrefix;
    constructor(logger: ILogger, cache: ICache);
    canProceed(resource?: string): Promise<boolean>;
    recordRequest(rateLimitInfo: RateLimitInfo): Promise<void>;
    getStatus(resource?: string): Promise<RateLimitInfo | null>;
    getDelay(resource?: string): Promise<number>;
    waitForReset(resource?: string): Promise<void>;
}
//# sourceMappingURL=RateLimitManager.d.ts.map