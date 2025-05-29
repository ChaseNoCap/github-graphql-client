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
import { createHmac, timingSafeEqual } from 'crypto';
import { GITHUB_TYPES } from '../types/InjectionTokens.js';
let WebhookProcessor = class WebhookProcessor {
    logger;
    handlers = new Map();
    constructor(logger) {
        this.logger = logger;
    }
    verifySignature(payload, signature, secret) {
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
        return timingSafeEqual(Buffer.from(expectedSignature, 'hex'), Buffer.from(actualSignature, 'hex'));
    }
    async processWebhook(headers, payload) {
        const eventName = headers['x-github-event'];
        const deliveryId = headers['x-github-delivery'];
        const signature = headers['x-hub-signature-256'];
        if (!eventName) {
            throw new Error('Missing x-github-event header');
        }
        if (!deliveryId) {
            throw new Error('Missing x-github-delivery header');
        }
        let parsedPayload;
        try {
            parsedPayload = JSON.parse(payload);
        }
        catch (error) {
            throw new Error('Invalid JSON payload');
        }
        const event = {
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
    on(eventName, handler) {
        if (!this.handlers.has(eventName)) {
            this.handlers.set(eventName, new Set());
        }
        this.handlers.get(eventName).add(handler);
        this.logger.debug('Event handler registered', { eventName });
    }
    off(eventName, handler) {
        const handlers = this.handlers.get(eventName);
        if (handlers) {
            handlers.delete(handler);
            if (handlers.size === 0) {
                this.handlers.delete(eventName);
            }
        }
        this.logger.debug('Event handler removed', { eventName });
    }
    async emit(eventName, event) {
        const handlers = this.handlers.get(eventName);
        if (!handlers || handlers.size === 0) {
            this.logger.debug('No handlers for event', { eventName });
            return;
        }
        const promises = [];
        for (const handler of handlers) {
            promises.push(handler(event).catch(error => {
                this.logger.error('Webhook handler failed', error, {
                    eventName,
                    deliveryId: event.id
                });
            }));
        }
        await Promise.all(promises);
        this.logger.debug('Event emitted to handlers', {
            eventName,
            handlerCount: handlers.size
        });
    }
};
WebhookProcessor = __decorate([
    injectable(),
    __param(0, inject(GITHUB_TYPES.ILogger)),
    __metadata("design:paramtypes", [Object])
], WebhookProcessor);
export { WebhookProcessor };
//# sourceMappingURL=WebhookProcessor.js.map