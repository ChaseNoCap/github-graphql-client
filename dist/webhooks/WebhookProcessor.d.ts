import type { ILogger } from '@chasenocap/logger';
import type { IWebhookProcessor } from '../interfaces/IWebhookProcessor.js';
import type { WebhookEvent } from '../types/GitHubTypes.js';
export declare class WebhookProcessor implements IWebhookProcessor {
    private readonly logger;
    private readonly handlers;
    constructor(logger: ILogger);
    verifySignature(payload: string, signature: string, secret: string): boolean;
    processWebhook(headers: Record<string, string>, payload: string): Promise<WebhookEvent>;
    on(eventName: string, handler: (event: WebhookEvent) => Promise<void>): void;
    off(eventName: string, handler: (event: WebhookEvent) => Promise<void>): void;
    emit(eventName: string, event: WebhookEvent): Promise<void>;
}
//# sourceMappingURL=WebhookProcessor.d.ts.map