import { Container } from 'inversify';
import 'reflect-metadata';
import { GitHubClient } from '../implementations/GitHubClient.js';
import { MetricsCollector } from '../implementations/MetricsCollector.js';
import { QueryRouter } from '../routing/QueryRouter.js';
import { RateLimitManager } from '../rate-limiting/RateLimitManager.js';
import { CircuitBreaker } from '../rate-limiting/CircuitBreaker.js';
import { WebhookProcessor } from '../webhooks/WebhookProcessor.js';
import { CacheManager } from '../caching/CacheManager.js';
import { GITHUB_TYPES } from '../types/InjectionTokens.js';
export function createGitHubContainer(config, logger, cache) {
    const container = new Container();
    // Bind configuration
    container.bind(GITHUB_TYPES.GitHubAuthConfig).toConstantValue(config);
    // Bind external dependencies
    container.bind(GITHUB_TYPES.ILogger).toConstantValue(logger);
    container.bind(GITHUB_TYPES.ICache).toConstantValue(cache);
    // Bind internal services
    container.bind(GITHUB_TYPES.IGitHubClient).to(GitHubClient).inSingletonScope();
    container.bind(GITHUB_TYPES.IQueryRouter).to(QueryRouter).inSingletonScope();
    container.bind(GITHUB_TYPES.IRateLimitManager).to(RateLimitManager).inSingletonScope();
    container.bind(GITHUB_TYPES.ICircuitBreaker).to(CircuitBreaker).inSingletonScope();
    container.bind(GITHUB_TYPES.IWebhookProcessor).to(WebhookProcessor).inSingletonScope();
    container.bind(GITHUB_TYPES.IMetricsCollector).to(MetricsCollector).inSingletonScope();
    container.bind(CacheManager).toSelf().inSingletonScope();
    return container;
}
//# sourceMappingURL=GitHubContainer.js.map