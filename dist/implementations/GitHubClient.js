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
import { Octokit } from '@octokit/rest';
import { graphql } from '@octokit/graphql';
import { CacheManager } from '../caching/CacheManager.js';
import { GITHUB_TYPES } from '../types/InjectionTokens.js';
let GitHubClient = class GitHubClient {
    config;
    logger;
    queryRouter;
    rateLimitManager;
    circuitBreaker;
    metricsCollector;
    cacheManager;
    octokit;
    graphqlClient;
    constructor(config, logger, queryRouter, rateLimitManager, circuitBreaker, metricsCollector, cacheManager) {
        this.config = config;
        this.logger = logger;
        this.queryRouter = queryRouter;
        this.rateLimitManager = rateLimitManager;
        this.circuitBreaker = circuitBreaker;
        this.metricsCollector = metricsCollector;
        this.cacheManager = cacheManager;
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
    async graphql(query, variables, options) {
        return this.executeRequest('GRAPHQL', query, variables, options);
    }
    async rest(method, path, data, options) {
        return this.executeRequest(method, path, { data }, options);
    }
    async request(query, variables, options) {
        const useGraphQL = options?.useGraphQL ?? this.queryRouter.shouldUseGraphQL(query, variables);
        if (useGraphQL) {
            const optimized = this.queryRouter.optimizeQuery(query, variables);
            return this.graphql(optimized.query, optimized.variables, options);
        }
        else {
            const restConversion = this.queryRouter.convertToRest(query, variables);
            if (restConversion) {
                return this.rest(restConversion.method, restConversion.path, restConversion.data, options);
            }
            else {
                // Fallback to GraphQL if conversion fails
                this.logger.warn('Failed to convert to REST, falling back to GraphQL', { query });
                return this.graphql(query, variables, options);
            }
        }
    }
    async batch(requests, options) {
        const results = [];
        // Process requests in batches to avoid overwhelming the API
        const batchSize = 10;
        for (let i = 0; i < requests.length; i += batchSize) {
            const batch = requests.slice(i, i + batchSize);
            const batchPromises = batch.map(req => this.request(req.query, req.variables, options));
            const batchResults = await Promise.allSettled(batchPromises);
            for (const result of batchResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                }
                else {
                    this.logger.error('Batch request failed', result.reason);
                    // Create error response
                    results.push({
                        data: null,
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
    getMetrics() {
        return this.metricsCollector.getMetrics();
    }
    async healthCheck() {
        try {
            await this.rest('GET', '/user');
            return true;
        }
        catch (error) {
            this.logger.error('Health check failed', error);
            return false;
        }
    }
    async executeRequest(method, query, variables, options) {
        const startTime = Date.now();
        // Check cache first
        let cacheKey = '';
        let fromCache = false;
        if (this.cacheManager.shouldCache(method, options)) {
            cacheKey = options?.cacheKey || this.cacheManager.generateCacheKey(method, query, variables);
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                fromCache = true;
                const responseTime = Date.now() - startTime;
                this.metricsCollector.recordRequest(method === 'GRAPHQL' ? 'graphql' : 'rest', responseTime, true);
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
            let response;
            let rateLimitInfo;
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
            }
            else {
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
            this.metricsCollector.recordRequest(method === 'GRAPHQL' ? 'graphql' : 'rest', responseTime, fromCache);
            return {
                data: response,
                rateLimitInfo,
                fromCache,
                responseTime
            };
        }, `${method}:${query}`);
    }
    getOctokitMethod(method, path) {
        // This is a simplified mapping - in a real implementation,
        // you'd have a more sophisticated router
        const cleanPath = path.replace(/^\//, '');
        const parts = cleanPath.split('/');
        switch (method) {
            case 'GET':
                if (parts[0] === 'repos' && parts.length === 3) {
                    return (variables) => this.octokit.repos.get({
                        owner: parts[1],
                        repo: parts[2],
                        ...variables?.data
                    });
                }
                if (parts[0] === 'users' && parts.length === 2) {
                    return (variables) => this.octokit.users.getByUsername({
                        username: parts[1],
                        ...variables?.data
                    });
                }
                break;
            // Add more method mappings as needed
        }
        // Fallback to generic request
        return (variables) => this.octokit.request(`${method} ${path}`, variables?.data);
    }
};
GitHubClient = __decorate([
    injectable(),
    __param(0, inject(GITHUB_TYPES.GitHubAuthConfig)),
    __param(1, inject(GITHUB_TYPES.ILogger)),
    __param(2, inject(GITHUB_TYPES.IQueryRouter)),
    __param(3, inject(GITHUB_TYPES.IRateLimitManager)),
    __param(4, inject(GITHUB_TYPES.ICircuitBreaker)),
    __param(5, inject(GITHUB_TYPES.IMetricsCollector)),
    __param(6, inject(CacheManager)),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object, Object, CacheManager])
], GitHubClient);
export { GitHubClient };
//# sourceMappingURL=GitHubClient.js.map