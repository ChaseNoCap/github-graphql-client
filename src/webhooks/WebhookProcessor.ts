import { injectable, inject } from 'inversify';
import { createHmac, timingSafeEqual } from 'crypto';
import type { ILogger } from '@chasenocap/logger';
import type { IWebhookProcessor } from '../interfaces/IWebhookProcessor.js';
import type { WebhookEvent } from '../types/GitHubTypes.js';
import { GITHUB_TYPES } from '../types/InjectionTokens.js';

@injectable()
export class WebhookProcessor implements IWebhookProcessor {
  private readonly handlers = new Map<string, Set<(event: WebhookEvent) => Promise<void>>>();
  
  constructor(
    @inject(GITHUB_TYPES.ILogger) private readonly logger: ILogger
  ) {}

  verifySignature(payload: string, signature: string, secret: string): boolean {
    if (!signature || !signature.startsWith('sha256=')) {
      this.logger.warn('Invalid signature format');
      return false;
    }
    
    const expectedSignature = createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');
    
    const actualSignature = signature.slice(7); // Remove 'sha256=' prefix
    
    if (expectedSignature.length !== actualSignature.length) {
      return false;
    }
    
    return timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(actualSignature, 'hex')
    );
  }

  async processWebhook(headers: Record<string, string>, payload: string): Promise<WebhookEvent> {
    const eventName = headers['x-github-event'];
    const deliveryId = headers['x-github-delivery'];
    const signature = headers['x-hub-signature-256'];
    
    if (!eventName) {
      throw new Error('Missing x-github-event header');
    }
    
    if (!deliveryId) {
      throw new Error('Missing x-github-delivery header');
    }
    
    let parsedPayload: Record<string, unknown>;
    try {
      parsedPayload = JSON.parse(payload);
    } catch (error) {
      throw new Error('Invalid JSON payload');
    }
    
    const event: WebhookEvent = {
      id: deliveryId,
      name: eventName,
      signature: signature || '',
      payload: parsedPayload,
      timestamp: new Date()
    };
    
    this.logger.info('Webhook received', { 
      eventName, 
      deliveryId, 
      hasSignature: !!signature 
    });
    
    // Emit event to registered handlers
    await this.emit(eventName, event);
    
    return event;
  }

  on(eventName: string, handler: (event: WebhookEvent) => Promise<void>): void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }
    
    this.handlers.get(eventName)!.add(handler);
    
    this.logger.debug('Event handler registered', { eventName });
  }

  off(eventName: string, handler: (event: WebhookEvent) => Promise<void>): void {
    const handlers = this.handlers.get(eventName);
    if (handlers) {
      handlers.delete(handler);
      
      if (handlers.size === 0) {
        this.handlers.delete(eventName);
      }
    }
    
    this.logger.debug('Event handler removed', { eventName });
  }

  async emit(eventName: string, event: WebhookEvent): Promise<void> {
    const handlers = this.handlers.get(eventName);
    
    if (!handlers || handlers.size === 0) {
      this.logger.debug('No handlers for event', { eventName });
      return;
    }
    
    const promises: Promise<void>[] = [];
    
    for (const handler of handlers) {
      promises.push(
        handler(event).catch(error => {
          this.logger.error('Webhook handler failed', error as Error, { 
            eventName, 
            deliveryId: event.id 
          });
        })
      );
    }
    
    await Promise.all(promises);
    
    this.logger.debug('Event emitted to handlers', { 
      eventName, 
      handlerCount: handlers.size 
    });
  }
}