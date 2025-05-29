import { injectable, inject } from 'inversify';
import { Octokit } from '@octokit/rest';
import { graphql } from '@octokit/graphql';
import type { ILogger } from '@chasenocap/logger';
import type { IGitHubClient } from '../interfaces/IGitHubClient.js';
import type { IQueryRouter } from '../interfaces/IQueryRouter.js';
import type { IRateLimitManager } from '../interfaces/IRateLimitManager.js';
import type { ICircuitBreaker } from '../interfaces/ICircuitBreaker.js';
import type { IMetricsCollector } from '../interfaces/IMetricsCollector.js';
import type { 
  GitHubAuthConfig,
  GitHubResponse, 
  GitHubRequestOptions, 
  GitHubMetrics,
  RateLimitInfo 
} from '../types/GitHubTypes.js';
import { CacheManager } from '../caching/CacheManager.js';
import { GITHUB_TYPES } from '../types/InjectionTokens.js';

@injectable()
export class GitHubClient implements IGitHubClient {
  private readonly octokit: Octokit;
  private readonly graphqlClient: typeof graphql;
  
  constructor(
    @inject(GITHUB_TYPES.GitHubAuthConfig) private readonly config: GitHubAuthConfig,
    @inject(GITHUB_TYPES.ILogger) private readonly logger: ILogger,
    @inject(GITHUB_TYPES.IQueryRouter) private readonly queryRouter: IQueryRouter,
    @inject(GITHUB_TYPES.IRateLimitManager) private readonly rateLimitManager: IRateLimitManager,
    @inject(GITHUB_TYPES.ICircuitBreaker) private readonly circuitBreaker: ICircuitBreaker,
    @inject(GITHUB_TYPES.IMetricsCollector) private readonly metricsCollector: IMetricsCollector,
    @inject(CacheManager) private readonly cacheManager: CacheManager
  ) {
    this.octokit = new Octokit({
      auth: config.token,
      userAgent: config.userAgent || 'github-graphql-client',
      baseUrl: config.baseUrl
    });
    
    this.graphqlClient = graphql.defaults({
      headers: {
        authorization: `token ${config.token}`,
        'user-agent': config.userAgent || 'github-graphql-client'
      },
      baseUrl: config.baseUrl
    });
  }

  async graphql<T = unknown>(
    query: string, 
    variables?: Record<string, unknown>, 
    options?: GitHubRequestOptions
  ): Promise<GitHubResponse<T>> {
    return this.executeRequest('GRAPHQL', query, variables, options);
  }

  async rest<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    data?: unknown,
    options?: GitHubRequestOptions
  ): Promise<GitHubResponse<T>> {
    return this.executeRequest(method, path, { data }, options);
  }

  async request<T = unknown>(
    query: string,
    variables?: Record<string, unknown>,
    options?: GitHubRequestOptions
  ): Promise<GitHubResponse<T>> {
    const useGraphQL = options?.useGraphQL ?? this.queryRouter.shouldUseGraphQL(query, variables);
    
    if (useGraphQL) {
      const optimized = this.queryRouter.optimizeQuery(query, variables);
      return this.graphql<T>(optimized.query, optimized.variables, options);
    } else {
      const restConversion = this.queryRouter.convertToRest(query, variables);
      if (restConversion) {
        return this.rest<T>(
          restConversion.method as 'GET' | 'POST' | 'PUT' | 'DELETE',
          restConversion.path,
          restConversion.data,
          options
        );
      } else {
        // Fallback to GraphQL if conversion fails
        this.logger.warn('Failed to convert to REST, falling back to GraphQL', { query });
        return this.graphql<T>(query, variables, options);
      }
    }
  }

  async batch<T = unknown>(
    requests: Array<{ query: string; variables?: Record<string, unknown> }>,
    options?: GitHubRequestOptions
  ): Promise<GitHubResponse<T>[]> {
    const results: GitHubResponse<T>[] = [];
    
    // Process requests in batches to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchPromises = batch.map(req => this.request<T>(req.query, req.variables, options));
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          this.logger.error('Batch request failed', result.reason);
          // Create error response
          results.push({
            data: null as T,
            rateLimitInfo: {
              limit: 0,
              remaining: 0,
              resetTimestamp: 0,
              used: 0,
              resource: 'unknown'
            },
            fromCache: false,
            responseTime: 0
          });
        }
      }
    }
    
    return results;
  }

  getMetrics(): GitHubMetrics {
    return this.metricsCollector.getMetrics();
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.rest('GET', '/user');
      return true;
    } catch (error) {
      this.logger.error('Health check failed', error as Error);
      return false;
    }
  }

  private async executeRequest<T>(
    method: string,
    query: string,
    variables?: Record<string, unknown>,
    options?: GitHubRequestOptions
  ): Promise<GitHubResponse<T>> {
    const startTime = Date.now();
    
    // Check cache first
    let cacheKey = '';
    let fromCache = false;
    
    if (this.cacheManager.shouldCache(method, options)) {
      cacheKey = options?.cacheKey || this.cacheManager.generateCacheKey(method, query, variables);
      const cached = await this.cacheManager.get<T>(cacheKey);
      
      if (cached) {
        fromCache = true;
        const responseTime = Date.now() - startTime;
        
        this.metricsCollector.recordRequest(
          method === 'GRAPHQL' ? 'graphql' : 'rest',
          responseTime,
          true
        );
        
        return {
          data: cached,
          rateLimitInfo: {
            limit: 0,
            remaining: 0,
            resetTimestamp: 0,
            used: 0,
            resource: 'cached'
          },
          fromCache: true,
          responseTime
        };
      }
    }
    
    // Execute with circuit breaker protection
    return this.circuitBreaker.execute(async () => {
      // Check rate limits
      if (!await this.rateLimitManager.canProceed()) {
        await this.rateLimitManager.waitForReset();
      }
      
      let response: any;
      let rateLimitInfo: RateLimitInfo;
      
      if (method === 'GRAPHQL') {
        const result = await this.graphqlClient(query, variables);
        response = result;
        
        // GraphQL doesn't expose rate limit headers in the same way
        rateLimitInfo = {
          limit: 5000,
          remaining: 5000,
          resetTimestamp: Math.floor(Date.now() / 1000) + 3600,
          used: 0,
          resource: 'graphql'
        };
      } else {
        const octokitMethod = this.getOctokitMethod(method, query);
        const result = await octokitMethod(variables);
        response = result.data;
        
        // Extract rate limit info from headers
        rateLimitInfo = {
          limit: parseInt(result.headers['x-ratelimit-limit'] || '5000'),
          remaining: parseInt(result.headers['x-ratelimit-remaining'] || '5000'),
          resetTimestamp: parseInt(result.headers['x-ratelimit-reset'] || '0'),
          used: parseInt(result.headers['x-ratelimit-used'] || '0'),
          resource: result.headers['x-ratelimit-resource'] || 'core'
        };
      }
      
      // Update rate limit tracking
      await this.rateLimitManager.recordRequest(rateLimitInfo);
      
      const responseTime = Date.now() - startTime;
      
      // Cache the response if appropriate
      if (this.cacheManager.shouldCache(method, options) && cacheKey) {
        await this.cacheManager.set(cacheKey, response, options);
      }
      
      // Record metrics
      this.metricsCollector.recordRequest(
        method === 'GRAPHQL' ? 'graphql' : 'rest',
        responseTime,
        fromCache
      );
      
      return {
        data: response,
        rateLimitInfo,
        fromCache,
        responseTime
      };
    }, `${method}:${query}`);
  }

  private getOctokitMethod(method: string, path: string): any {
    // This is a simplified mapping - in a real implementation,
    // you'd have a more sophisticated router
    const cleanPath = path.replace(/^\//, '');
    const parts = cleanPath.split('/');
    
    switch (method) {
      case 'GET':
        if (parts[0] === 'repos' && parts.length === 3) {
          return (variables: any) => this.octokit.repos.get({
            owner: parts[1],
            repo: parts[2],
            ...variables?.data
          });
        }
        if (parts[0] === 'users' && parts.length === 2) {
          return (variables: any) => this.octokit.users.getByUsername({
            username: parts[1],
            ...variables?.data
          });
        }
        break;
      // Add more method mappings as needed
    }
    
    // Fallback to generic request
    return (variables: any) => this.octokit.request(`${method} ${path}`, variables?.data);
  }
}