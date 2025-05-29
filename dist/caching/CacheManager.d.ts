import type { ILogger } from '@chasenocap/logger';
import type { ICache } from '@chasenocap/cache';
import type { GitHubRequestOptions } from '../types/GitHubTypes.js';
export declare class CacheManager {
    private readonly logger;
    private readonly cache;
    private readonly defaultTTL;
    private readonly cachePrefix;
    constructor(logger: ILogger, cache: ICache);
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, options?: GitHubRequestOptions): Promise<void>;
    delete(key: string): Promise<void>;
    invalidatePattern(pattern: string): Promise<void>;
    generateCacheKey(method: string, path: string, variables?: Record<string, unknown>): string;
    shouldCache(method: string, options?: GitHubRequestOptions): boolean;
    private getCacheKey;
    private hashObject;
}
//# sourceMappingURL=CacheManager.d.ts.map