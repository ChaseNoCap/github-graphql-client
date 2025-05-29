import { Container } from 'inversify';
import 'reflect-metadata';

import type { ILogger } from '@chasenocap/logger';
import type { ICache } from '@chasenocap/cache';

import type { IGitHubClient } from '../interfaces/IGitHubClient.js';
import type { IQueryRouter } from '../interfaces/IQueryRouter.js';
import type { IRateLimitManager } from '../interfaces/IRateLimitManager.js';
import type { ICircuitBreaker } from '../interfaces/ICircuitBreaker.js';
import type { IWebhookProcessor } from '../interfaces/IWebhookProcessor.js';
import type { IMetricsCollector } from '../interfaces/IMetricsCollector.js';

import { GitHubClient } from '../implementations/GitHubClient.js';
import { MetricsCollector } from '../implementations/MetricsCollector.js';
import { QueryRouter } from '../routing/QueryRouter.js';
import { RateLimitManager } from '../rate-limiting/RateLimitManager.js';
import { CircuitBreaker } from '../rate-limiting/CircuitBreaker.js';
import { WebhookProcessor } from '../webhooks/WebhookProcessor.js';
import { CacheManager } from '../caching/CacheManager.js';

import type { GitHubAuthConfig } from '../types/GitHubTypes.js';
import { GITHUB_TYPES } from '../types/InjectionTokens.js';

export function createGitHubContainer(
  config: GitHubAuthConfig,
  logger: ILogger,
  cache: ICache
): Container {
  const container = new Container();

  // Bind configuration
  container.bind<GitHubAuthConfig>(GITHUB_TYPES.GitHubAuthConfig).toConstantValue(config);
  
  // Bind external dependencies
  container.bind<ILogger>(GITHUB_TYPES.ILogger).toConstantValue(logger);
  container.bind<ICache>(GITHUB_TYPES.ICache).toConstantValue(cache);

  // Bind internal services
  container.bind<IGitHubClient>(GITHUB_TYPES.IGitHubClient).to(GitHubClient).inSingletonScope();
  container.bind<IQueryRouter>(GITHUB_TYPES.IQueryRouter).to(QueryRouter).inSingletonScope();
  container.bind<IRateLimitManager>(GITHUB_TYPES.IRateLimitManager).to(RateLimitManager).inSingletonScope();
  container.bind<ICircuitBreaker>(GITHUB_TYPES.ICircuitBreaker).to(CircuitBreaker).inSingletonScope();
  container.bind<IWebhookProcessor>(GITHUB_TYPES.IWebhookProcessor).to(WebhookProcessor).inSingletonScope();
  container.bind<IMetricsCollector>(GITHUB_TYPES.IMetricsCollector).to(MetricsCollector).inSingletonScope();
  container.bind<CacheManager>(CacheManager).toSelf().inSingletonScope();

  return container;
}