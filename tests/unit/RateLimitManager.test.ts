import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Container } from 'inversify';
import { RateLimitManager } from '../../src/rate-limiting/RateLimitManager.js';
import { GITHUB_TYPES } from '../../src/types/InjectionTokens.js';
import type { ILogger } from '@chasenocap/logger';
import type { ICache } from '@chasenocap/cache';
import type { RateLimitInfo } from '../../src/types/GitHubTypes.js';

describe('RateLimitManager', () => {
  let rateLimitManager: RateLimitManager;
  let mockLogger: ILogger;
  let mockCache: ICache;

  beforeEach(() => {
    const container = new Container();
    
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    } as unknown as ILogger;

    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn()
    } as unknown as ICache;

    container.bind<ILogger>(GITHUB_TYPES.ILogger).toConstantValue(mockLogger);
    container.bind<ICache>(GITHUB_TYPES.ICache).toConstantValue(mockCache);
    container.bind(RateLimitManager).toSelf();

    rateLimitManager = container.get(RateLimitManager);
  });

  describe('canProceed', () => {
    it('should allow request when no rate limit info exists', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);

      const result = await rateLimitManager.canProceed();
      expect(result).toBe(true);
    });

    it('should allow request when remaining quota exists', async () => {
      const rateLimitInfo: RateLimitInfo = {
        limit: 5000,
        remaining: 1000,
        resetTimestamp: Math.floor(Date.now() / 1000) + 3600,
        used: 4000,
        resource: 'core'
      };

      vi.mocked(mockCache.get).mockResolvedValue(rateLimitInfo);

      const result = await rateLimitManager.canProceed();
      expect(result).toBe(true);
    });

    it('should deny request when rate limit exceeded and not reset', async () => {
      const rateLimitInfo: RateLimitInfo = {
        limit: 5000,
        remaining: 0,
        resetTimestamp: Math.floor(Date.now() / 1000) + 3600,
        used: 5000,
        resource: 'core'
      };

      vi.mocked(mockCache.get).mockResolvedValue(rateLimitInfo);

      const result = await rateLimitManager.canProceed();
      expect(result).toBe(false);
    });

    it('should allow request when rate limit has reset', async () => {
      const rateLimitInfo: RateLimitInfo = {
        limit: 5000,
        remaining: 0,
        resetTimestamp: Math.floor(Date.now() / 1000) - 3600, // Reset 1 hour ago
        used: 5000,
        resource: 'core'
      };

      vi.mocked(mockCache.get).mockResolvedValue(rateLimitInfo);

      const result = await rateLimitManager.canProceed();
      expect(result).toBe(true);
      expect(mockCache.delete).toHaveBeenCalledWith('github:ratelimit:core');
    });
  });

  describe('recordRequest', () => {
    it('should store rate limit info in cache', async () => {
      const rateLimitInfo: RateLimitInfo = {
        limit: 5000,
        remaining: 4999,
        resetTimestamp: Math.floor(Date.now() / 1000) + 3600,
        used: 1,
        resource: 'core'
      };

      await rateLimitManager.recordRequest(rateLimitInfo);

      expect(mockCache.set).toHaveBeenCalledWith(
        'github:ratelimit:core',
        rateLimitInfo,
        expect.any(Number)
      );
    });
  });

  describe('getDelay', () => {
    it('should return 0 when no rate limit info exists', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);

      const delay = await rateLimitManager.getDelay();
      expect(delay).toBe(0);
    });

    it('should return 0 when remaining quota exists', async () => {
      const rateLimitInfo: RateLimitInfo = {
        limit: 5000,
        remaining: 1000,
        resetTimestamp: Math.floor(Date.now() / 1000) + 3600,
        used: 4000,
        resource: 'core'
      };

      vi.mocked(mockCache.get).mockResolvedValue(rateLimitInfo);

      const delay = await rateLimitManager.getDelay();
      expect(delay).toBe(0);
    });

    it('should return correct delay when rate limit exceeded', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 1800; // Reset in 30 minutes
      const rateLimitInfo: RateLimitInfo = {
        limit: 5000,
        remaining: 0,
        resetTimestamp: resetTime,
        used: 5000,
        resource: 'core'
      };

      vi.mocked(mockCache.get).mockResolvedValue(rateLimitInfo);

      const delay = await rateLimitManager.getDelay();
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThanOrEqual(1800 * 1000); // Should be about 30 minutes in ms
    });
  });

  describe('waitForReset', () => {
    it('should not wait when no delay needed', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);

      const startTime = Date.now();
      await rateLimitManager.waitForReset();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be almost instant
    });

    it('should wait for the calculated delay', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 1; // Reset in 1 second
      const rateLimitInfo: RateLimitInfo = {
        limit: 5000,
        remaining: 0,
        resetTimestamp: resetTime,
        used: 5000,
        resource: 'core'
      };

      vi.mocked(mockCache.get).mockResolvedValue(rateLimitInfo);

      const startTime = Date.now();
      await rateLimitManager.waitForReset();
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(900); // Should wait close to 1 second
    });
  });
});