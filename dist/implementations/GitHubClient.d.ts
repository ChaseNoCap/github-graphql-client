import type { ILogger } from '@chasenocap/logger';
import type { IGitHubClient } from '../interfaces/IGitHubClient.js';
import type { IQueryRouter } from '../interfaces/IQueryRouter.js';
import type { IRateLimitManager } from '../interfaces/IRateLimitManager.js';
import type { ICircuitBreaker } from '../interfaces/ICircuitBreaker.js';
import type { IMetricsCollector } from '../interfaces/IMetricsCollector.js';
import type { GitHubAuthConfig, GitHubResponse, GitHubRequestOptions, GitHubMetrics } from '../types/GitHubTypes.js';
import { CacheManager } from '../caching/CacheManager.js';
export declare class GitHubClient implements IGitHubClient {
    private readonly config;
    private readonly logger;
    private readonly queryRouter;
    private readonly rateLimitManager;
    private readonly circuitBreaker;
    private readonly metricsCollector;
    private readonly cacheManager;
    private readonly octokit;
    private readonly graphqlClient;
    constructor(config: GitHubAuthConfig, logger: ILogger, queryRouter: IQueryRouter, rateLimitManager: IRateLimitManager, circuitBreaker: ICircuitBreaker, metricsCollector: IMetricsCollector, cacheManager: CacheManager);
    graphql<T = unknown>(query: string, variables?: Record<string, unknown>, options?: GitHubRequestOptions): Promise<GitHubResponse<T>>;
    rest<T = unknown>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, data?: unknown, options?: GitHubRequestOptions): Promise<GitHubResponse<T>>;
    request<T = unknown>(query: string, variables?: Record<string, unknown>, options?: GitHubRequestOptions): Promise<GitHubResponse<T>>;
    batch<T = unknown>(requests: Array<{
        query: string;
        variables?: Record<string, unknown>;
    }>, options?: GitHubRequestOptions): Promise<GitHubResponse<T>[]>;
    getMetrics(): GitHubMetrics;
    healthCheck(): Promise<boolean>;
    private executeRequest;
    private getOctokitMethod;
}
//# sourceMappingURL=GitHubClient.d.ts.map