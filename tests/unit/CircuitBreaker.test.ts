import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Container } from 'inversify';
import { CircuitBreaker } from '../../src/rate-limiting/CircuitBreaker.js';
import { GITHUB_TYPES } from '../../src/types/InjectionTokens.js';
import type { ILogger } from '@chasenocap/logger';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  let mockLogger: ILogger;

  beforeEach(() => {
    const container = new Container();
    
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    } as unknown as ILogger;

    container.bind<ILogger>(GITHUB_TYPES.ILogger).toConstantValue(mockLogger);
    container.bind(CircuitBreaker).toSelf();

    circuitBreaker = container.get(CircuitBreaker);
  });

  describe('execute', () => {
    it('should execute function successfully in CLOSED state', async () => {
      const testFn = vi.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(testFn);

      expect(result).toBe('success');
      expect(testFn).toHaveBeenCalled();
    });

    it('should record success and reset failure count', async () => {
      const testFn = vi.fn().mockResolvedValue('success');

      await circuitBreaker.execute(testFn);

      const state = circuitBreaker.getState();
      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);
    });

    it('should record failure and increment failure count', async () => {
      const testFn = vi.fn().mockRejectedValue(new Error('test error'));

      await expect(circuitBreaker.execute(testFn)).rejects.toThrow('test error');

      const state = circuitBreaker.getState();
      expect(state.failureCount).toBe(1);
    });

    it('should transition to OPEN after failure threshold', async () => {
      const testFn = vi.fn().mockRejectedValue(new Error('test error'));

      // Execute 5 failed requests to reach threshold
      for (let i = 0; i < 5; i++) {
        await expect(circuitBreaker.execute(testFn)).rejects.toThrow();
      }

      const state = circuitBreaker.getState();
      expect(state.state).toBe('OPEN');
      expect(state.failureCount).toBe(5);
    });

    it('should reject requests immediately when OPEN', async () => {
      const testFn = vi.fn().mockRejectedValue(new Error('test error'));

      // Force circuit breaker to OPEN state
      circuitBreaker.forceOpen();

      await expect(circuitBreaker.execute(testFn)).rejects.toThrow('Circuit breaker is OPEN');
      expect(testFn).not.toHaveBeenCalled();
    });
  });

  describe('getState', () => {
    it('should return initial CLOSED state', () => {
      const state = circuitBreaker.getState();

      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);
    });

    it('should track separate states for different contexts', () => {
      const state1 = circuitBreaker.getState('context1');
      const state2 = circuitBreaker.getState('context2');

      expect(state1).not.toBe(state2);
      expect(state1.state).toBe('CLOSED');
      expect(state2.state).toBe('CLOSED');
    });
  });

  describe('forceOpen', () => {
    it('should force circuit breaker to OPEN state', () => {
      circuitBreaker.forceOpen();

      const state = circuitBreaker.getState();
      expect(state.state).toBe('OPEN');
      expect(state.lastFailureTime).toBeDefined();
      expect(state.nextAttemptTime).toBeDefined();
    });
  });

  describe('reset', () => {
    it('should reset circuit breaker to CLOSED state', () => {
      // Force to OPEN state first
      circuitBreaker.forceOpen();
      expect(circuitBreaker.getState().state).toBe('OPEN');

      // Reset
      circuitBreaker.reset();

      const state = circuitBreaker.getState();
      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);
    });
  });

  describe('half-open behavior', () => {
    it('should transition to HALF_OPEN after timeout', async () => {
      const testFn = vi.fn().mockResolvedValue('success');

      // Force to OPEN with past next attempt time
      circuitBreaker.forceOpen();
      const state = circuitBreaker.getState();
      state.nextAttemptTime = Date.now() - 1000; // 1 second ago

      await circuitBreaker.execute(testFn);

      const newState = circuitBreaker.getState();
      expect(newState.state).toBe('CLOSED'); // Should transition back to CLOSED after success
    });

    it('should go back to OPEN if HALF_OPEN request fails', async () => {
      const testFn = vi.fn().mockRejectedValue(new Error('test error'));

      // Force to OPEN with past next attempt time
      circuitBreaker.forceOpen();
      const state = circuitBreaker.getState();
      state.nextAttemptTime = Date.now() - 1000; // 1 second ago

      await expect(circuitBreaker.execute(testFn)).rejects.toThrow();

      const newState = circuitBreaker.getState();
      expect(newState.state).toBe('OPEN');
    });
  });
});