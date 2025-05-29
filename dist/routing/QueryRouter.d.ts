import type { ILogger } from '@chasenocap/logger';
import type { IQueryRouter } from '../interfaces/IQueryRouter.js';
import type { QueryComplexity } from '../types/GitHubTypes.js';
export declare class QueryRouter implements IQueryRouter {
    private readonly logger;
    constructor(logger: ILogger);
    shouldUseGraphQL(query: string, variables?: Record<string, unknown>): boolean;
    convertToRest(query: string, variables?: Record<string, unknown>): {
        method: string;
        path: string;
        data?: unknown;
    } | null;
    analyzeComplexity(query: string, variables?: Record<string, unknown>): QueryComplexity;
    optimizeQuery(query: string, variables?: Record<string, unknown>): {
        query: string;
        variables?: Record<string, unknown>;
    };
    private calculateDepth;
    private calculateBreadth;
    private estimateCost;
    private requiresMultipleRestCalls;
    private isSimpleResourceQuery;
    private removeRedundantFields;
}
//# sourceMappingURL=QueryRouter.d.ts.map