import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Container } from 'inversify';
import { WebhookProcessor } from '../../src/webhooks/WebhookProcessor.js';
import { GITHUB_TYPES } from '../../src/types/InjectionTokens.js';
import type { ILogger } from '@chasenocap/logger';

describe('WebhookProcessor', () => {
  let webhookProcessor: WebhookProcessor;
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
    container.bind(WebhookProcessor).toSelf();

    webhookProcessor = container.get(WebhookProcessor);
  });

  describe('verifySignature', () => {
    it('should verify valid signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'my-secret';
      const signature = 'sha256=52b582138706ac0c597c80cfe0a7bf862ecb827f9a1f8c6a99c2596ed0bf8217';

      const result = webhookProcessor.verifySignature(payload, signature, secret);
      expect(result).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'my-secret';
      const signature = 'sha256=invalid-signature';

      const result = webhookProcessor.verifySignature(payload, signature, secret);
      expect(result).toBe(false);
    });

    it('should reject signature without sha256 prefix', () => {
      const payload = '{"test": "data"}';
      const secret = 'my-secret';
      const signature = 'invalid-format';

      const result = webhookProcessor.verifySignature(payload, signature, secret);
      expect(result).toBe(false);
    });

    it('should reject empty signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'my-secret';
      const signature = '';

      const result = webhookProcessor.verifySignature(payload, signature, secret);
      expect(result).toBe(false);
    });
  });

  describe('processWebhook', () => {
    it('should process valid webhook', async () => {
      const headers = {
        'x-github-event': 'push',
        'x-github-delivery': '12345-67890',
        'x-hub-signature-256': 'sha256=test-signature'
      };
      const payload = '{"ref": "refs/heads/main"}';

      const event = await webhookProcessor.processWebhook(headers, payload);

      expect(event.id).toBe('12345-67890');
      expect(event.name).toBe('push');
      expect(event.signature).toBe('sha256=test-signature');
      expect(event.payload).toEqual({ ref: 'refs/heads/main' });
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should throw error for missing event header', async () => {
      const headers = {
        'x-github-delivery': '12345-67890'
      };
      const payload = '{"test": "data"}';

      await expect(webhookProcessor.processWebhook(headers, payload)).rejects.toThrow('Missing x-github-event header');
    });

    it('should throw error for missing delivery header', async () => {
      const headers = {
        'x-github-event': 'push'
      };
      const payload = '{"test": "data"}';

      await expect(webhookProcessor.processWebhook(headers, payload)).rejects.toThrow('Missing x-github-delivery header');
    });

    it('should throw error for invalid JSON payload', async () => {
      const headers = {
        'x-github-event': 'push',
        'x-github-delivery': '12345-67890'
      };
      const payload = 'invalid-json';

      await expect(webhookProcessor.processWebhook(headers, payload)).rejects.toThrow('Invalid JSON payload');
    });
  });

  describe('event handling', () => {
    it('should register and call event handlers', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      webhookProcessor.on('push', handler);

      const headers = {
        'x-github-event': 'push',
        'x-github-delivery': '12345-67890'
      };
      const payload = '{"ref": "refs/heads/main"}';

      await webhookProcessor.processWebhook(headers, payload);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        id: '12345-67890',
        name: 'push',
        payload: { ref: 'refs/heads/main' }
      }));
    });

    it('should remove event handlers', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      webhookProcessor.on('push', handler);
      webhookProcessor.off('push', handler);

      const headers = {
        'x-github-event': 'push',
        'x-github-delivery': '12345-67890'
      };
      const payload = '{"ref": "refs/heads/main"}';

      await webhookProcessor.processWebhook(headers, payload);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle multiple handlers for same event', async () => {
      const handler1 = vi.fn().mockResolvedValue(undefined);
      const handler2 = vi.fn().mockResolvedValue(undefined);
      
      webhookProcessor.on('push', handler1);
      webhookProcessor.on('push', handler2);

      const headers = {
        'x-github-event': 'push',
        'x-github-delivery': '12345-67890'
      };
      const payload = '{"ref": "refs/heads/main"}';

      await webhookProcessor.processWebhook(headers, payload);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should handle errors in event handlers gracefully', async () => {
      const failingHandler = vi.fn().mockRejectedValue(new Error('Handler error'));
      const successHandler = vi.fn().mockResolvedValue(undefined);
      
      webhookProcessor.on('push', failingHandler);
      webhookProcessor.on('push', successHandler);

      const headers = {
        'x-github-event': 'push',
        'x-github-delivery': '12345-67890'
      };
      const payload = '{"ref": "refs/heads/main"}';

      // Should not throw despite handler error
      await expect(webhookProcessor.processWebhook(headers, payload)).resolves.not.toThrow();

      expect(failingHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Webhook handler failed',
        expect.any(Error),
        expect.objectContaining({
          eventName: 'push',
          deliveryId: '12345-67890'
        })
      );
    });
  });
});