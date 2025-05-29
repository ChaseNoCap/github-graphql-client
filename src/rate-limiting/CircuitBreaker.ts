import { injectable, inject } from 'inversify';
import type { ILogger } from '@chasenocap/logger';
import type { ICircuitBreaker } from '../interfaces/ICircuitBreaker.js';
import type { CircuitBreakerState } from '../types/GitHubTypes.js';
import { GITHUB_TYPES } from '../types/InjectionTokens.js';

@injectable()
export class CircuitBreaker implements ICircuitBreaker {
  private readonly states = new Map<string, CircuitBreakerState>();
  private readonly failureThreshold = 5;
  private readonly timeout = 60000; // 1 minute
  private readonly halfOpenRetryDelay = 30000; // 30 seconds
  
  constructor(
    @inject(GITHUB_TYPES.ILogger) private readonly logger: ILogger
  ) {}

  async execute<T>(fn: () => Promise<T>, context = 'default'): Promise<T> {
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
    } catch (error) {
      this.recordFailure(context);
      throw error;
    }
  }

  getState(context = 'default'): CircuitBreakerState {
    if (!this.states.has(context)) {
      this.states.set(context, {
        state: 'CLOSED',
        failureCount: 0
      });
    }
    
    return this.states.get(context)!;
  }

  forceOpen(context = 'default'): void {
    const state = this.getState(context);
    state.state = 'OPEN';
    state.lastFailureTime = Date.now();
    state.nextAttemptTime = Date.now() + this.timeout;
    
    this.logger.warn('Circuit breaker forced OPEN', { context });
  }

  reset(context = 'default'): void {
    this.states.set(context, {
      state: 'CLOSED',
      failureCount: 0
    });
    
    this.logger.info('Circuit breaker reset to CLOSED', { context });
  }

  recordSuccess(context = 'default'): void {
    const state = this.getState(context);
    
    if (state.state === 'HALF_OPEN') {
      // Success in HALF_OPEN state, transition back to CLOSED
      state.state = 'CLOSED';
      state.failureCount = 0;
      delete state.lastFailureTime;
      delete state.nextAttemptTime;
      
      this.logger.info('Circuit breaker transitioned to CLOSED after successful half-open request', { context });
    } else if (state.state === 'CLOSED') {
      // Reset failure count on success
      state.failureCount = 0;
    }
  }

  recordFailure(context = 'default'): void {
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
    } else if (state.state === 'CLOSED' && state.failureCount >= this.failureThreshold) {
      // Too many failures, transition to OPEN
      state.state = 'OPEN';
      state.nextAttemptTime = Date.now() + this.timeout;
      
      this.logger.error('Circuit breaker transitioned to OPEN due to failure threshold', new Error(`Circuit breaker failed for ${context}. Failure count: ${state.failureCount}, threshold: ${this.failureThreshold}`));
    }
  }

  private transitionToHalfOpen(context: string): void {
    const state = this.getState(context);
    state.state = 'HALF_OPEN';
    delete state.nextAttemptTime;
    
    this.logger.info('Circuit breaker transitioned to HALF_OPEN', { context });
  }
}