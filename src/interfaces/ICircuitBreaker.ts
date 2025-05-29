import type { CircuitBreakerState } from '../types/GitHubTypes.js';

export interface ICircuitBreaker {
  /**
   * Execute a function with circuit breaker protection
   */
  execute<T>(fn: () => Promise<T>, context?: string): Promise<T>;
  
  /**
   * Get current circuit breaker state
   */
  getState(context?: string): CircuitBreakerState;
  
  /**
   * Force circuit breaker to open state
   */
  forceOpen(context?: string): void;
  
  /**
   * Reset circuit breaker to closed state
   */
  reset(context?: string): void;
  
  /**
   * Record a successful operation
   */
  recordSuccess(context?: string): void;
  
  /**
   * Record a failed operation
   */
  recordFailure(context?: string): void;
}