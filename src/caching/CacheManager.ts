import { injectable, inject } from 'inversify';
import type { ILogger } from '@chasenocap/logger';
import type { ICache } from '@chasenocap/cache';
import type { GitHubRequestOptions } from '../types/GitHubTypes.js';
import { GITHUB_TYPES } from '../types/InjectionTokens.js';

@injectable()
export class CacheManager {
  private readonly defaultTTL = 300; // 5 minutes
  private readonly cachePrefix = 'github:';
  
  constructor(
    @inject(GITHUB_TYPES.ILogger) private readonly logger: ILogger,
    @inject(GITHUB_TYPES.ICache) private readonly cache: ICache
  ) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.getCacheKey(key);
      const result = await this.cache.get(fullKey) as T | null;
      
      if (result !== null) {
        this.logger.debug('Cache hit', { key: fullKey });
      } else {
        this.logger.debug('Cache miss', { key: fullKey });
      }
      
      return result;
    } catch (error) {
      this.logger.error('Cache get failed', error as Error, { key });
      return null;
    }
  }

  async set<T>(key: string, value: T, options?: GitHubRequestOptions): Promise<void> {
    try {
      const fullKey = this.getCacheKey(key);
      const ttl = options?.cacheTTL || this.defaultTTL;
      
      await this.cache.set(fullKey, value, ttl);
      
      this.logger.debug('Cache set', { key: fullKey, ttl });
    } catch (error) {
      this.logger.error('Cache set failed', error as Error, { key, options });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const fullKey = this.getCacheKey(key);
      await this.cache.delete(fullKey);
      
      this.logger.debug('Cache delete', { key: fullKey });
    } catch (error) {
      this.logger.error('Cache delete failed', error as Error, { key });
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      // This assumes the cache implementation supports pattern-based invalidation
      // For implementations that don't support this, you'd need to track keys separately
      const fullPattern = this.getCacheKey(pattern);
      
      if ('deletePattern' in this.cache) {
        await (this.cache as any).deletePattern(fullPattern);
        this.logger.debug('Cache pattern invalidated', { pattern: fullPattern });
      } else {
        this.logger.warn('Cache does not support pattern invalidation', { pattern });
      }
    } catch (error) {
      this.logger.error('Cache pattern invalidation failed', error as Error, { pattern });
    }
  }

  generateCacheKey(method: string, path: string, variables?: Record<string, unknown>): string {
    const pathKey = path.replace(/[^a-zA-Z0-9]/g, '_');
    const variablesKey = variables ? this.hashObject(variables) : '';
    
    return `${method}:${pathKey}${variablesKey ? ':' + variablesKey : ''}`;
  }

  shouldCache(method: string, options?: GitHubRequestOptions): boolean {
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

  private getCacheKey(key: string): string {
    return `${this.cachePrefix}${key}`;
  }

  private hashObject(obj: Record<string, unknown>): string {
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
}