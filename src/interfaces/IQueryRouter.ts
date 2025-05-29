import type { QueryComplexity } from '../types/GitHubTypes.js';

export interface IQueryRouter {
  /**
   * Analyze if a query should use GraphQL or REST
   */
  shouldUseGraphQL(query: string, variables?: Record<string, unknown>): boolean;
  
  /**
   * Convert GraphQL query to equivalent REST endpoint if possible
   */
  convertToRest(query: string, variables?: Record<string, unknown>): { method: string; path: string; data?: unknown } | null;
  
  /**
   * Analyze query complexity
   */
  analyzeComplexity(query: string, variables?: Record<string, unknown>): QueryComplexity;
  
  /**
   * Optimize query for performance
   */
  optimizeQuery(query: string, variables?: Record<string, unknown>): { query: string; variables?: Record<string, unknown> };
}