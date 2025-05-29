import type { GitHubResponse, GitHubRequestOptions, GitHubMetrics } from '../types/GitHubTypes.js';

export interface IGitHubClient {
  /**
   * Execute a GraphQL query against GitHub's GraphQL API
   */
  graphql<T = unknown>(query: string, variables?: Record<string, unknown>, options?: GitHubRequestOptions): Promise<GitHubResponse<T>>;
  
  /**
   * Execute a REST API request against GitHub's REST API
   */
  rest<T = unknown>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, data?: unknown, options?: GitHubRequestOptions): Promise<GitHubResponse<T>>;
  
  /**
   * Smart request that chooses GraphQL or REST based on query analysis
   */
  request<T = unknown>(query: string, variables?: Record<string, unknown>, options?: GitHubRequestOptions): Promise<GitHubResponse<T>>;
  
  /**
   * Batch multiple requests efficiently
   */
  batch<T = unknown>(requests: Array<{ query: string; variables?: Record<string, unknown> }>, options?: GitHubRequestOptions): Promise<GitHubResponse<T>[]>;
  
  /**
   * Get current metrics
   */
  getMetrics(): GitHubMetrics;
  
  /**
   * Health check
   */
  healthCheck(): Promise<boolean>;
}