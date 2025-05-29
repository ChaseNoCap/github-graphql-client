import type { WebhookEvent } from '../types/GitHubTypes.js';

export interface IWebhookProcessor {
  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string, secret: string): boolean;
  
  /**
   * Process incoming webhook
   */
  processWebhook(headers: Record<string, string>, payload: string): Promise<WebhookEvent>;
  
  /**
   * Register event handler
   */
  on(eventName: string, handler: (event: WebhookEvent) => Promise<void>): void;
  
  /**
   * Remove event handler
   */
  off(eventName: string, handler: (event: WebhookEvent) => Promise<void>): void;
  
  /**
   * Emit event to registered handlers
   */
  emit(eventName: string, event: WebhookEvent): Promise<void>;
}