import { injectable, inject } from 'inversify';
import type { ILogger } from '@chasenocap/logger';
import type { ICache } from '@chasenocap/cache';
import type { IRateLimitManager } from '../interfaces/IRateLimitManager.js';
import type { RateLimitInfo } from '../types/GitHubTypes.js';
import { GITHUB_TYPES } from '../types/InjectionTokens.js';

@injectable()
export class RateLimitManager implements IRateLimitManager {
  private readonly cachePrefix = 'github:ratelimit:';
  
  constructor(
    @inject(GITHUB_TYPES.ILogger) private readonly logger: ILogger,
    @inject(GITHUB_TYPES.ICache) private readonly cache: ICache
  ) {}

  async canProceed(resource = 'core'): Promise<boolean> {
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

  async recordRequest(rateLimitInfo: RateLimitInfo): Promise<void> {
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

  async getStatus(resource = 'core'): Promise<RateLimitInfo | null> {
    const key = `${this.cachePrefix}${resource}`;
    return await this.cache.get(key) as RateLimitInfo | null;
  }

  async getDelay(resource = 'core'): Promise<number> {
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

  async waitForReset(resource = 'core'): Promise<void> {
    const delay = await this.getDelay(resource);
    
    if (delay > 0) {
      this.logger.info('Waiting for rate limit reset', { 
        resource, 
        delaySeconds: delay / 1000 
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}