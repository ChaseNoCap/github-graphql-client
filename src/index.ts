// Main interfaces
export type { IGitHubClient } from './interfaces/IGitHubClient.js';
export type { IQueryRouter } from './interfaces/IQueryRouter.js';
export type { IRateLimitManager } from './interfaces/IRateLimitManager.js';
export type { ICircuitBreaker } from './interfaces/ICircuitBreaker.js';
export type { IWebhookProcessor } from './interfaces/IWebhookProcessor.js';
export type { IMetricsCollector } from './interfaces/IMetricsCollector.js';

// Types
export type {
  GitHubAuthConfig,
  GitHubRequestOptions,
  GitHubResponse,
  GitHubMetrics,
  RateLimitInfo,
  CircuitBreakerState,
  WebhookEvent,
  QueryComplexity
} from './types/GitHubTypes.js';

export { GITHUB_TYPES } from './types/InjectionTokens.js';

// Implementations
export { GitHubClient } from './implementations/GitHubClient.js';
export { MetricsCollector } from './implementations/MetricsCollector.js';
export { QueryRouter } from './routing/QueryRouter.js';
export { RateLimitManager } from './rate-limiting/RateLimitManager.js';
export { CircuitBreaker } from './rate-limiting/CircuitBreaker.js';
export { WebhookProcessor } from './webhooks/WebhookProcessor.js';
export { CacheManager } from './caching/CacheManager.js';

// Container utility
export { createGitHubContainer } from './utils/GitHubContainer.js';