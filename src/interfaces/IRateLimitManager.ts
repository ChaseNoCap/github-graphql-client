import type { RateLimitInfo } from '../types/GitHubTypes.js';

export interface IRateLimitManager {
  /**
   * Check if request can proceed without hitting rate limits
   */
  canProceed(resource?: string): Promise<boolean>;
  
  /**
   * Record a request and update rate limit tracking
   */
  recordRequest(rateLimitInfo: RateLimitInfo): Promise<void>;
  
  /**
   * Get current rate limit status
   */
  getStatus(resource?: string): Promise<RateLimitInfo | null>;
  
  /**
   * Calculate delay needed before next request
   */
  getDelay(resource?: string): Promise<number>;
  
  /**
   * Wait for rate limit to reset if needed
   */
  waitForReset(resource?: string): Promise<void>;
}