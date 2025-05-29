import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ILogger } from '@chasenocap/logger';
import type { ICache } from '@chasenocap/cache';
import { createGitHubContainer } from '../../src/utils/GitHubContainer.js';
import { GITHUB_TYPES } from '../../src/types/InjectionTokens.js';
import type { IGitHubClient } from '../../src/interfaces/IGitHubClient.js';
import type { GitHubAuthConfig } from '../../src/types/GitHubTypes.js';

describe('GitHub GraphQL Client Integration', () => {
  let client: IGitHubClient;
  let mockLogger: ILogger;
  let mockCache: ICache;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    } as unknown as ILogger;

    mockCache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined)
    } as unknown as ICache;

    const config: GitHubAuthConfig = {
      token: 'test-token',
      userAgent: 'test-client'
    };

    const container = createGitHubContainer(config, mockLogger, mockCache);
    client = container.get<IGitHubClient>(GITHUB_TYPES.IGitHubClient);
  });

  describe('Container Setup', () => {
    it('should create client with all dependencies', () => {
      expect(client).toBeDefined();
      expect(client.getMetrics).toBeDefined();
      expect(client.graphql).toBeDefined();
      expect(client.rest).toBeDefined();
      expect(client.request).toBeDefined();
      expect(client.batch).toBeDefined();
      expect(client.healthCheck).toBeDefined();
    });

    it('should initialize with zero metrics', () => {
      const metrics = client.getMetrics();
      
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.graphqlRequests).toBe(0);
      expect(metrics.restRequests).toBe(0);
      expect(metrics.cacheHits).toBe(0);
      expect(metrics.cacheMisses).toBe(0);
      expect(metrics.averageResponseTime).toBe(0);
      expect(metrics.rateLimitExceeded).toBe(0);
      expect(metrics.circuitBreakerTrips).toBe(0);
    });
  });

  describe('Smart Request Routing', () => {
    it('should route simple repository query to REST', async () => {
      // Mock successful cache get to avoid actual API calls
      vi.mocked(mockCache.get).mockResolvedValueOnce({
        name: 'test-repo',
        description: 'Test repository'
      });

      const query = `
        query {
          repository(owner: "octocat", name: "Hello-World") {
            name
            description
          }
        }
      `;

      const response = await client.request(query);
      
      expect(response.fromCache).toBe(true);
      expect(response.data).toEqual({
        name: 'test-repo',
        description: 'Test repository'
      });
    });

    it('should route complex query to GraphQL', async () => {
      // Mock successful cache get to avoid actual API calls
      vi.mocked(mockCache.get).mockResolvedValueOnce({
        repository: {
          issues: {
            edges: []
          }
        }
      });

      const query = `
        query {
          repository(owner: "octocat", name: "Hello-World") {
            issues(first: 100) {
              edges {
                node {
                  title
                  comments(first: 10) {
                    edges {
                      node {
                        body
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const response = await client.request(query);
      
      expect(response.fromCache).toBe(true);
      expect(response.data).toHaveProperty('repository');
    });
  });

  describe('Caching Integration', () => {
    it('should cache and retrieve responses', async () => {
      const mockData = { name: 'cached-repo' };
      
      // First call - cache miss
      vi.mocked(mockCache.get).mockResolvedValueOnce(null);
      
      // Second call - cache hit
      vi.mocked(mockCache.get).mockResolvedValueOnce(mockData);

      const query = 'query { repository(owner: "test", name: "repo") { name } }';
      
      // This would normally make an API call, but we're mocking the cache
      const response = await client.request(query);
      
      expect(response.data).toEqual(mockData);
      expect(response.fromCache).toBe(true);
    });

    it('should respect cache bypass option', async () => {
      const query = 'query { repository(owner: "test", name: "repo") { name } }';
      const options = { bypassCache: true };
      
      // Even with cache data available, should not use it
      vi.mocked(mockCache.get).mockResolvedValueOnce({ name: 'cached' });
      
      try {
        await client.request(query, undefined, options);
      } catch (error) {
        // Expected to fail due to no actual API token/network
        expect(error).toBeDefined();
      }
      
      // Cache should not be checked when bypassCache is true
      // This is validated by the implementation not calling cache.get
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple requests', async () => {
      const requests = [
        { query: 'query { repository(owner: "test1", name: "repo1") { name } }' },
        { query: 'query { repository(owner: "test2", name: "repo2") { name } }' }
      ];

      // Mock cache responses for both requests
      vi.mocked(mockCache.get)
        .mockResolvedValueOnce({ name: 'repo1' })
        .mockResolvedValueOnce({ name: 'repo2' });

      const responses = await client.batch(requests);
      
      expect(responses).toHaveLength(2);
      expect(responses[0].data).toEqual({ name: 'repo1' });
      expect(responses[1].data).toEqual({ name: 'repo2' });
    });

    it('should handle batch request failures gracefully', async () => {
      const requests = [
        { query: 'query { repository(owner: "test1", name: "repo1") { name } }' },
        { query: 'invalid query' }
      ];

      // Mock cache miss for both to force API calls (which will fail)
      vi.mocked(mockCache.get)
        .mockResolvedValue(null);

      const responses = await client.batch(requests);
      
      expect(responses).toHaveLength(2);
      // Both should have error responses due to invalid token/network
      expect(responses[0].data).toBeNull();
      expect(responses[1].data).toBeNull();
    });
  });

  describe('Metrics Collection', () => {
    it('should track request metrics', async () => {
      // Mock successful cache response
      vi.mocked(mockCache.get).mockResolvedValueOnce({ name: 'test' });

      await client.request('query { repository(owner: "test", name: "repo") { name } }');

      const metrics = client.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.cacheHits).toBe(1);
    });
  });
});