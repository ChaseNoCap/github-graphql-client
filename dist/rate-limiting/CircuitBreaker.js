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
let CircuitBreaker = class CircuitBreaker {
    logger;
    states = new Map();
    failureThreshold = 5;
    timeout = 60000; // 1 minute
    halfOpenRetryDelay = 30000; // 30 seconds
    constructor(logger) {
        this.logger = logger;
    }
    async execute(fn, context = 'default') {
        const state = this.getState(context);
        switch (state.state) {
            case 'OPEN':
                if (Date.now() < (state.nextAttemptTime || 0)) {
                    throw new Error(`Circuit breaker is OPEN for context: ${context}`);
                }
                // Transition to HALF_OPEN
                this.transitionToHalfOpen(context);
                break;
            case 'HALF_OPEN':
                // Allow one request through
                break;
            case 'CLOSED':
                // Normal operation
                break;
        }
        try {
            const result = await fn();
            this.recordSuccess(context);
            return result;
        }
        catch (error) {
            this.recordFailure(context);
            throw error;
        }
    }
    getState(context = 'default') {
        if (!this.states.has(context)) {
            this.states.set(context, {
                state: 'CLOSED',
                failureCount: 0
            });
        }
        return this.states.get(context);
    }
    forceOpen(context = 'default') {
        const state = this.getState(context);
        state.state = 'OPEN';
        state.lastFailureTime = Date.now();
        state.nextAttemptTime = Date.now() + this.timeout;
        this.logger.warn('Circuit breaker forced OPEN', { context });
    }
    reset(context = 'default') {
        this.states.set(context, {
            state: 'CLOSED',
            failureCount: 0
        });
        this.logger.info('Circuit breaker reset to CLOSED', { context });
    }
    recordSuccess(context = 'default') {
        const state = this.getState(context);
        if (state.state === 'HALF_OPEN') {
            // Success in HALF_OPEN state, transition back to CLOSED
            state.state = 'CLOSED';
            state.failureCount = 0;
            delete state.lastFailureTime;
            delete state.nextAttemptTime;
            this.logger.info('Circuit breaker transitioned to CLOSED after successful half-open request', { context });
        }
        else if (state.state === 'CLOSED') {
            // Reset failure count on success
            state.failureCount = 0;
        }
    }
    recordFailure(context = 'default') {
        const state = this.getState(context);
        state.failureCount++;
        state.lastFailureTime = Date.now();
        if (state.state === 'HALF_OPEN') {
            // Failure in HALF_OPEN state, go back to OPEN
            state.state = 'OPEN';
            state.nextAttemptTime = Date.now() + this.timeout;
            this.logger.warn('Circuit breaker transitioned back to OPEN after failed half-open request', {
                context,
                failureCount: state.failureCount
            });
        }
        else if (state.state === 'CLOSED' && state.failureCount >= this.failureThreshold) {
            // Too many failures, transition to OPEN
            state.state = 'OPEN';
            state.nextAttemptTime = Date.now() + this.timeout;
            this.logger.error('Circuit breaker transitioned to OPEN due to failure threshold', new Error(`Circuit breaker failed for ${context}. Failure count: ${state.failureCount}, threshold: ${this.failureThreshold}`));
        }
    }
    transitionToHalfOpen(context) {
        const state = this.getState(context);
        state.state = 'HALF_OPEN';
        delete state.nextAttemptTime;
        this.logger.info('Circuit breaker transitioned to HALF_OPEN', { context });
    }
};
CircuitBreaker = __decorate([
    injectable(),
    __param(0, inject(GITHUB_TYPES.ILogger)),
    __metadata("design:paramtypes", [Object])
], CircuitBreaker);
export { CircuitBreaker };
//# sourceMappingURL=CircuitBreaker.js.map