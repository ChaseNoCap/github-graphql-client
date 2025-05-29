export const GITHUB_TYPES = {
  // Core interfaces
  IGitHubClient: Symbol.for('IGitHubClient'),
  IQueryRouter: Symbol.for('IQueryRouter'),
  ICacheManager: Symbol.for('ICacheManager'),
  IRateLimitManager: Symbol.for('IRateLimitManager'),
  ICircuitBreaker: Symbol.for('ICircuitBreaker'),
  IWebhookProcessor: Symbol.for('IWebhookProcessor'),
  IMetricsCollector: Symbol.for('IMetricsCollector'),
  
  // Configuration
  GitHubAuthConfig: Symbol.for('GitHubAuthConfig'),
  
  // External dependencies
  ILogger: Symbol.for('ILogger'),
  ICache: Symbol.for('ICache')
} as const;