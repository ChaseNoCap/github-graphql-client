var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { injectable, inject } from 'inversify';
import { GITHUB_TYPES } from '../types/InjectionTokens.js';
let CacheManager = class CacheManager {
    logger;
    cache;
    defaultTTL = 300; // 5 minutes
    cachePrefix = 'github:';
    constructor(logger, cache) {
        this.logger = logger;
        this.cache = cache;
    }
    async get(key) {
        try {
            const fullKey = this.getCacheKey(key);
            const result = await this.cache.get(fullKey);
            if (result !== null) {
                this.logger.debug('Cache hit', { key: fullKey });
            }
            else {
                this.logger.debug('Cache miss', { key: fullKey });
            }
            return result;
        }
        catch (error) {
            this.logger.error('Cache get failed', error, { key });
            return null;
        }
    }
    async set(key, value, options) {
        try {
            const fullKey = this.getCacheKey(key);
            const ttl = options?.cacheTTL || this.defaultTTL;
            await this.cache.set(fullKey, value, ttl);
            this.logger.debug('Cache set', { key: fullKey, ttl });
        }
        catch (error) {
            this.logger.error('Cache set failed', error, { key, options });
        }
    }
    async delete(key) {
        try {
            const fullKey = this.getCacheKey(key);
            await this.cache.delete(fullKey);
            this.logger.debug('Cache delete', { key: fullKey });
        }
        catch (error) {
            this.logger.error('Cache delete failed', error, { key });
        }
    }
    async invalidatePattern(pattern) {
        try {
            // This assumes the cache implementation supports pattern-based invalidation
            // For implementations that don't support this, you'd need to track keys separately
            const fullPattern = this.getCacheKey(pattern);
            if ('deletePattern' in this.cache) {
                await this.cache.deletePattern(fullPattern);
                this.logger.debug('Cache pattern invalidated', { pattern: fullPattern });
            }
            else {
                this.logger.warn('Cache does not support pattern invalidation', { pattern });
            }
        }
        catch (error) {
            this.logger.error('Cache pattern invalidation failed', error, { pattern });
        }
    }
    generateCacheKey(method, path, variables) {
        const pathKey = path.replace(/[^a-zA-Z0-9]/g, '_');
        const variablesKey = variables ? this.hashObject(variables) : '';
        return `${method}:${pathKey}${variablesKey ? ':' + variablesKey : ''}`;
    }
    shouldCache(method, options) {
        // Don't cache if explicitly disabled
        if (options?.bypassCache) {
            return false;
        }
        // Only cache GET requests and GraphQL queries
        if (method !== 'GET' && method !== 'GRAPHQL') {
            return false;
        }
        return true;
    }
    getCacheKey(key) {
        return `${this.cachePrefix}${key}`;
    }
    hashObject(obj) {
        // Simple hash function for cache keys
        // In production, you might want to use a more robust hashing algorithm
        const str = JSON.stringify(obj, Object.keys(obj).sort());
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }
};
CacheManager = __decorate([
    injectable(),
    __param(0, inject(GITHUB_TYPES.ILogger)),
    __param(1, inject(GITHUB_TYPES.ICache)),
    __metadata("design:paramtypes", [Object, Object])
], CacheManager);
export { CacheManager };
//# sourceMappingURL=CacheManager.js.map