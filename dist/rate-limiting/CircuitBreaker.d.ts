import type { ILogger } from '@chasenocap/logger';
import type { ICircuitBreaker } from '../interfaces/ICircuitBreaker.js';
import type { CircuitBreakerState } from '../types/GitHubTypes.js';
export declare class CircuitBreaker implements ICircuitBreaker {
    private readonly logger;
    private readonly states;
    private readonly failureThreshold;
    private readonly timeout;
    private readonly halfOpenRetryDelay;
    constructor(logger: ILogger);
    execute<T>(fn: () => Promise<T>, context?: string): Promise<T>;
    getState(context?: string): CircuitBreakerState;
    forceOpen(context?: string): void;
    reset(context?: string): void;
    recordSuccess(context?: string): void;
    recordFailure(context?: string): void;
    private transitionToHalfOpen;
}
//# sourceMappingURL=CircuitBreaker.d.ts.map