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
import { GITHUB_TYPES } from '../types/InjectionTokens.js';
let MetricsCollector = class MetricsCollector {
    logger;
    metrics = {
        totalRequests: 0,
        graphqlRequests: 0,
        restRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        averageResponseTime: 0,
        rateLimitExceeded: 0,
        circuitBreakerTrips: 0
    };
    responseTimes = [];
    maxResponseTimeHistory = 1000;
    timestampedMetrics = [];
    maxHistorySize = 10000;
    constructor(logger) {
        this.logger = logger;
    }
    recordRequest(type, responseTime, fromCache) {
        this.metrics.totalRequests++;
        if (type === 'graphql') {
            this.metrics.graphqlRequests++;
        }
        else {
            this.metrics.restRequests++;
        }
        if (fromCache) {
            this.metrics.cacheHits++;
        }
        else {
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
    recordRateLimitExceeded() {
        this.metrics.rateLimitExceeded++;
        this.addTimestampedMetric({
            timestamp: new Date(),
            type: 'rate-limit'
        });
        this.logger.warn('Rate limit exceeded recorded', {
            total: this.metrics.rateLimitExceeded
        });
    }
    recordCircuitBreakerTrip() {
        this.metrics.circuitBreakerTrips++;
        this.addTimestampedMetric({
            timestamp: new Date(),
            type: 'circuit-breaker'
        });
        this.logger.warn('Circuit breaker trip recorded', {
            total: this.metrics.circuitBreakerTrips
        });
    }
    getMetrics() {
        return { ...this.metrics };
    }
    resetMetrics() {
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
    getMetricsForPeriod(startTime, endTime) {
        const periodMetrics = this.timestampedMetrics.filter(metric => metric.timestamp >= startTime && metric.timestamp <= endTime);
        const result = {
            totalRequests: 0,
            graphqlRequests: 0,
            restRequests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            averageResponseTime: 0,
            rateLimitExceeded: 0,
            circuitBreakerTrips: 0
        };
        const responseTimes = [];
        for (const metric of periodMetrics) {
            switch (metric.type) {
                case 'request':
                    result.totalRequests++;
                    if (metric.requestType === 'graphql') {
                        result.graphqlRequests++;
                    }
                    else {
                        result.restRequests++;
                    }
                    if (metric.fromCache) {
                        result.cacheHits++;
                    }
                    else {
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
    addTimestampedMetric(metric) {
        this.timestampedMetrics.push(metric);
        // Keep history size manageable
        if (this.timestampedMetrics.length > this.maxHistorySize) {
            this.timestampedMetrics.shift();
        }
    }
};
MetricsCollector = __decorate([
    injectable(),
    __param(0, inject(GITHUB_TYPES.ILogger)),
    __metadata("design:paramtypes", [Object])
], MetricsCollector);
export { MetricsCollector };
//# sourceMappingURL=MetricsCollector.js.map