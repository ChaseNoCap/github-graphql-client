export interface GitHubAuthConfig {
  token: string;
  userAgent?: string;
  baseUrl?: string;
}

export interface GitHubRequestOptions {
  useGraphQL?: boolean;
  cacheKey?: string;
  cacheTTL?: number;
  bypassCache?: boolean;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTimestamp: number;
  used: number;
  resource: string;
}

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime?: number;
  nextAttemptTime?: number;
}

export interface GitHubResponse<T = unknown> {
  data: T;
  rateLimitInfo: RateLimitInfo;
  fromCache: boolean;
  responseTime: number;
}

export interface WebhookEvent {
  id: string;
  name: string;
  signature: string;
  payload: Record<string, unknown>;
  timestamp: Date;
}

export interface QueryComplexity {
  depth: number;
  breadth: number;
  estimatedCost: number;
}

export interface GitHubMetrics {
  totalRequests: number;
  graphqlRequests: number;
  restRequests: number;
  cacheHits: number;
  cacheMisses: number;
  averageResponseTime: number;
  rateLimitExceeded: number;
  circuitBreakerTrips: number;
}