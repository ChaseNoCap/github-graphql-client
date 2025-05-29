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
let RateLimitManager = class RateLimitManager {
    logger;
    cache;
    cachePrefix = 'github:ratelimit:';
    constructor(logger, cache) {
        this.logger = logger;
        this.cache = cache;
    }
    async canProceed(resource = 'core') {
        const status = await this.getStatus(resource);
        if (!status) {
            // No rate limit info available, allow request
            return true;
        }
        if (status.remaining > 0) {
            return true;
        }
        // Check if rate limit has reset
        const now = Date.now();
        if (now >= status.resetTimestamp * 1000) {
            // Rate limit has reset
            await this.cache.delete(`${this.cachePrefix}${resource}`);
            return true;
        }
        this.logger.warn('Rate limit exceeded', {
            resource,
            remaining: status.remaining,
            resetTime: new Date(status.resetTimestamp * 1000)
        });
        return false;
    }
    async recordRequest(rateLimitInfo) {
        const key = `${this.cachePrefix}${rateLimitInfo.resource}`;
        const ttl = Math.max(0, rateLimitInfo.resetTimestamp - Math.floor(Date.now() / 1000));
        await this.cache.set(key, rateLimitInfo, ttl);
        this.logger.debug('Rate limit info recorded', {
            resource: rateLimitInfo.resource,
            remaining: rateLimitInfo.remaining,
            limit: rateLimitInfo.limit,
            resetTime: new Date(rateLimitInfo.resetTimestamp * 1000)
        });
    }
    async getStatus(resource = 'core') {
        const key = `${this.cachePrefix}${resource}`;
        return await this.cache.get(key);
    }
    async getDelay(resource = 'core') {
        const status = await this.getStatus(resource);
        if (!status) {
            return 0;
        }
        if (status.remaining > 0) {
            return 0;
        }
        const now = Math.floor(Date.now() / 1000);
        const delay = Math.max(0, status.resetTimestamp - now);
        return delay * 1000; // Convert to milliseconds
    }
    async waitForReset(resource = 'core') {
        const delay = await this.getDelay(resource);
        if (delay > 0) {
            this.logger.info('Waiting for rate limit reset', {
                resource,
                delaySeconds: delay / 1000
            });
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};
RateLimitManager = __decorate([
    injectable(),
    __param(0, inject(GITHUB_TYPES.ILogger)),
    __param(1, inject(GITHUB_TYPES.ICache)),
    __metadata("design:paramtypes", [Object, Object])
], RateLimitManager);
export { RateLimitManager };
//# sourceMappingURL=RateLimitManager.js.map