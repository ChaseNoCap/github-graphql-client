import { injectable, inject } from 'inversify';
import type { ILogger } from '@chasenocap/logger';
import type { IMetricsCollector } from '../interfaces/IMetricsCollector.js';
import type { GitHubMetrics } from '../types/GitHubTypes.js';
import { GITHUB_TYPES } from '../types/InjectionTokens.js';

interface TimestampedMetric {
  timestamp: Date;
  type: 'request' | 'rate-limit' | 'circuit-breaker';
  requestType?: 'graphql' | 'rest';
  responseTime?: number;
  fromCache?: boolean;
}

@injectable()
export class MetricsCollector implements IMetricsCollector {
  private metrics: GitHubMetrics = {
    totalRequests: 0,
    graphqlRequests: 0,
    restRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageResponseTime: 0,
    rateLimitExceeded: 0,
    circuitBreakerTrips: 0
  };
  
  private responseTimes: number[] = [];
  private readonly maxResponseTimeHistory = 1000;
  private readonly timestampedMetrics: TimestampedMetric[] = [];
  private readonly maxHistorySize = 10000;
  
  constructor(
    @inject(GITHUB_TYPES.ILogger) private readonly logger: ILogger
  ) {}

  recordRequest(type: 'graphql' | 'rest', responseTime: number, fromCache: boolean): void {
    this.metrics.totalRequests++;
    
    if (type === 'graphql') {
      this.metrics.graphqlRequests++;
    } else {
      this.metrics.restRequests++;
    }
    
    if (fromCache) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }
    
    // Track response times
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > this.maxResponseTimeHistory) {
      this.responseTimes.shift();
    }
    
    // Update average response time
    this.metrics.averageResponseTime = this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
    
    // Store timestamped metric
    this.addTimestampedMetric({
      timestamp: new Date(),
      type: 'request',
      requestType: type,
      responseTime,
      fromCache
    });
    
    this.logger.debug('Request recorded', { 
      type, 
      responseTime, 
      fromCache, 
      totalRequests: this.metrics.totalRequests 
    });
  }

  recordRateLimitExceeded(): void {
    this.metrics.rateLimitExceeded++;
    
    this.addTimestampedMetric({
      timestamp: new Date(),
      type: 'rate-limit'
    });
    
    this.logger.warn('Rate limit exceeded recorded', { 
      total: this.metrics.rateLimitExceeded 
    });
  }

  recordCircuitBreakerTrip(): void {
    this.metrics.circuitBreakerTrips++;
    
    this.addTimestampedMetric({
      timestamp: new Date(),
      type: 'circuit-breaker'
    });
    
    this.logger.warn('Circuit breaker trip recorded', { 
      total: this.metrics.circuitBreakerTrips 
    });
  }

  getMetrics(): GitHubMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      graphqlRequests: 0,
      restRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      rateLimitExceeded: 0,
      circuitBreakerTrips: 0
    };
    
    this.responseTimes.length = 0;
    this.timestampedMetrics.length = 0;
    
    this.logger.info('Metrics reset');
  }

  getMetricsForPeriod(startTime: Date, endTime: Date): GitHubMetrics {
    const periodMetrics = this.timestampedMetrics.filter(
      metric => metric.timestamp >= startTime && metric.timestamp <= endTime
    );
    
    const result: GitHubMetrics = {
      totalRequests: 0,
      graphqlRequests: 0,
      restRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      rateLimitExceeded: 0,
      circuitBreakerTrips: 0
    };
    
    const responseTimes: number[] = [];
    
    for (const metric of periodMetrics) {
      switch (metric.type) {
        case 'request':
          result.totalRequests++;
          if (metric.requestType === 'graphql') {
            result.graphqlRequests++;
          } else {
            result.restRequests++;
          }
          
          if (metric.fromCache) {
            result.cacheHits++;
          } else {
            result.cacheMisses++;
          }
          
          if (metric.responseTime) {
            responseTimes.push(metric.responseTime);
          }
          break;
          
        case 'rate-limit':
          result.rateLimitExceeded++;
          break;
          
        case 'circuit-breaker':
          result.circuitBreakerTrips++;
          break;
      }
    }
    
    if (responseTimes.length > 0) {
      result.averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    }
    
    return result;
  }

  private addTimestampedMetric(metric: TimestampedMetric): void {
    this.timestampedMetrics.push(metric);
    
    // Keep history size manageable
    if (this.timestampedMetrics.length > this.maxHistorySize) {
      this.timestampedMetrics.shift();
    }
  }
}