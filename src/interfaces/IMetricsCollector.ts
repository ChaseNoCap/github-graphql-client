import type { GitHubMetrics } from '../types/GitHubTypes.js';

export interface IMetricsCollector {
  /**
   * Record a request
   */
  recordRequest(type: 'graphql' | 'rest', responseTime: number, fromCache: boolean): void;
  
  /**
   * Record rate limit exceeded
   */
  recordRateLimitExceeded(): void;
  
  /**
   * Record circuit breaker trip
   */
  recordCircuitBreakerTrip(): void;
  
  /**
   * Get current metrics
   */
  getMetrics(): GitHubMetrics;
  
  /**
   * Reset metrics
   */
  resetMetrics(): void;
  
  /**
   * Get metrics for specific time period
   */
  getMetricsForPeriod(startTime: Date, endTime: Date): GitHubMetrics;
}