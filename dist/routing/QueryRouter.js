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
import { GITHUB_TYPES } from '../types/InjectionTokens.js';
let QueryRouter = class QueryRouter {
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    shouldUseGraphQL(query, variables) {
        const complexity = this.analyzeComplexity(query, variables);
        // Use GraphQL for complex queries or when fetching multiple related resources
        if (complexity.depth > 2 || complexity.breadth > 3) {
            this.logger.debug('Using GraphQL for complex query', { complexity });
            return true;
        }
        // Use GraphQL for queries that would require multiple REST calls
        if (this.requiresMultipleRestCalls(query)) {
            this.logger.debug('Using GraphQL to avoid multiple REST calls');
            return true;
        }
        // Use REST for simple, single-resource queries
        if (this.isSimpleResourceQuery(query)) {
            this.logger.debug('Using REST for simple resource query');
            return false;
        }
        // Default to GraphQL for flexibility
        return true;
    }
    convertToRest(query, variables) {
        const trimmed = query.trim();
        // Repository query
        if (trimmed.includes('repository(') && trimmed.includes('owner:') && trimmed.includes('name:')) {
            const ownerMatch = /owner:\s*"([^"]+)"/;
            const nameMatch = /name:\s*"([^"]+)"/;
            const owner = ownerMatch.exec(trimmed)?.[1];
            const name = nameMatch.exec(trimmed)?.[1];
            if (owner && name) {
                return {
                    method: 'GET',
                    path: `/repos/${owner}/${name}`
                };
            }
        }
        // User query
        if (trimmed.includes('user(') && trimmed.includes('login:')) {
            const loginMatch = /login:\s*"([^"]+)"/;
            const login = loginMatch.exec(trimmed)?.[1];
            if (login) {
                return {
                    method: 'GET',
                    path: `/users/${login}`
                };
            }
        }
        // Pull request query
        if (trimmed.includes('pullRequest(') && variables?.owner && variables?.repo && variables?.number) {
            return {
                method: 'GET',
                path: `/repos/${variables.owner}/${variables.repo}/pulls/${variables.number}`
            };
        }
        // Issue query
        if (trimmed.includes('issue(') && variables?.owner && variables?.repo && variables?.number) {
            return {
                method: 'GET',
                path: `/repos/${variables.owner}/${variables.repo}/issues/${variables.number}`
            };
        }
        this.logger.debug('Cannot convert query to REST', { query: trimmed });
        return null;
    }
    analyzeComplexity(query, variables) {
        const depth = this.calculateDepth(query);
        const breadth = this.calculateBreadth(query);
        const estimatedCost = this.estimateCost(query, variables);
        return { depth, breadth, estimatedCost };
    }
    optimizeQuery(query, variables) {
        let optimized = query;
        // Remove unnecessary whitespace
        optimized = optimized.replace(/\s+/g, ' ').trim();
        // Add first/last limits to pagination if missing
        if (optimized.includes('edges') && !optimized.includes('first:') && !optimized.includes('last:')) {
            optimized = optimized.replace(/\{(\s*)edges/, '(first: 100) {$1edges');
        }
        // Optimize field selection by removing redundant fields
        optimized = this.removeRedundantFields(optimized);
        this.logger.debug('Query optimized', {
            original: query.length,
            optimized: optimized.length
        });
        return { query: optimized, variables };
    }
    calculateDepth(query) {
        let depth = 0;
        let current = 0;
        for (const char of query) {
            if (char === '{') {
                current++;
                depth = Math.max(depth, current);
            }
            else if (char === '}') {
                current--;
            }
        }
        return depth;
    }
    calculateBreadth(query) {
        // Count number of top-level fields
        const topLevelFields = query.match(/\w+(?=\s*[\({])/g) || [];
        return topLevelFields.length;
    }
    estimateCost(query, variables) {
        let cost = 1; // Base cost
        // Add cost for each field
        const fields = query.match(/\w+/g) || [];
        cost += fields.length * 0.1;
        // Add cost for pagination
        const paginationMatch = query.match(/first:\s*(\d+)|last:\s*(\d+)/g);
        if (paginationMatch) {
            for (const match of paginationMatch) {
                const number = parseInt(match.match(/\d+/)?.[0] || '0');
                cost += number * 0.01;
            }
        }
        // Add cost for complex operations
        if (query.includes('search('))
            cost += 10;
        if (query.includes('commits('))
            cost += 5;
        if (query.includes('issues('))
            cost += 3;
        if (query.includes('pullRequests('))
            cost += 3;
        return Math.round(cost);
    }
    requiresMultipleRestCalls(query) {
        // Check if query spans multiple resources
        const resourceTypes = [
            'repository', 'user', 'organization', 'pullRequest', 'issue', 'commit'
        ];
        let resourceCount = 0;
        for (const resourceType of resourceTypes) {
            if (query.includes(resourceType + '(')) {
                resourceCount++;
            }
        }
        return resourceCount > 1;
    }
    isSimpleResourceQuery(query) {
        // Simple queries that are better served by REST
        const simplePatterns = [
            /^{\s*repository\([^}]+\)\s*{\s*\w+(\s+\w+)*\s*}\s*}$/,
            /^{\s*user\([^}]+\)\s*{\s*\w+(\s+\w+)*\s*}\s*}$/,
            /^{\s*organization\([^}]+\)\s*{\s*\w+(\s+\w+)*\s*}\s*}$/
        ];
        return simplePatterns.some(pattern => pattern.test(query.replace(/\s+/g, ' ').trim()));
    }
    removeRedundantFields(query) {
        // This is a simplified implementation
        // In a real implementation, you'd parse the AST and remove truly redundant fields
        return query;
    }
};
QueryRouter = __decorate([
    injectable(),
    __param(0, inject(GITHUB_TYPES.ILogger)),
    __metadata("design:paramtypes", [Object])
], QueryRouter);
export { QueryRouter };
//# sourceMappingURL=QueryRouter.js.map