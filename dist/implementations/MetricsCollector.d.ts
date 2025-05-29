import type { ILogger } from '@chasenocap/logger';
import type { IMetricsCollector } from '../interfaces/IMetricsCollector.js';
import type { GitHubMetrics } from '../types/GitHubTypes.js';
export declare class MetricsCollector implements IMetricsCollector {
    private readonly logger;
    private metrics;
    private responseTimes;
    private readonly maxResponseTimeHistory;
    private readonly timestampedMetrics;
    private readonly maxHistorySize;
    constructor(logger: ILogger);
    recordRequest(type: 'graphql' | 'rest', responseTime: number, fromCache: boolean): void;
    recordRateLimitExceeded(): void;
    recordCircuitBreakerTrip(): void;
    getMetrics(): GitHubMetrics;
    resetMetrics(): void;
    getMetricsForPeriod(startTime: Date, endTime: Date): GitHubMetrics;
    private addTimestampedMetric;
}
//# sourceMappingURL=MetricsCollector.d.ts.map