# CLAUDE.md - @chasenocap/github-graphql-client

## Package Overview
Smart GitHub API client that intelligently routes between GitHub's GraphQL and REST APIs, with built-in caching, rate limiting, circuit breaker protection, and webhook processing capabilities.

## Key Responsibilities
1. **Smart API Routing**: Analyze queries and route to optimal GitHub API (GraphQL vs REST)
2. **Rate Limit Management**: Track and respect GitHub's rate limits across all API types
3. **Circuit Breaker Protection**: Prevent cascading failures with configurable circuit breakers
4. **Multi-Layer Caching**: Implement Redis and in-memory caching with intelligent invalidation
5. **Webhook Processing**: Secure webhook signature verification and event handling
6. **Performance Monitoring**: Comprehensive metrics collection and reporting

## Architecture & Design

### Core Components
- **GitHubClient**: Main client interface with smart routing
- **QueryRouter**: Analyzes queries and determines optimal API strategy
- **RateLimitManager**: Tracks rate limits and manages API quotas
- **CircuitBreaker**: Implements circuit breaker pattern for fault tolerance
- **CacheManager**: Multi-layer caching with TTL and invalidation
- **WebhookProcessor**: Secure webhook processing with event emission
- **MetricsCollector**: Performance and usage metrics tracking

### Dependencies
- `@octokit/rest`: GitHub REST API client
- `@octokit/graphql`: GitHub GraphQL client
- `@octokit/webhooks`: Webhook utilities
- `inversify`: Dependency injection framework
- `@chasenocap/logger`: Logging interface
- `@chasenocap/cache`: Caching interface

## Usage Patterns

### Basic Setup
```typescript
import { createGitHubContainer, GITHUB_TYPES } from '@chasenocap/github-graphql-client';

const container = createGitHubContainer(
  { token: 'github-token' },
  logger,
  cache
);

const client = container.get<IGitHubClient>(GITHUB_TYPES.IGitHubClient);
```

### Smart Request Routing
```typescript
// Simple repository query → routed to REST
const repo = await client.request(`
  query {
    repository(owner: "owner", name: "repo") {
      name
      description
    }
  }
`);

// Complex nested query → routed to GraphQL
const issues = await client.request(`
  query {
    repository(owner: "owner", name: "repo") {
      issues(first: 100) {
        edges {
          node {
            title
            comments(first: 10) {
              edges { node { body } }
            }
          }
        }
      }
    }
  }
`);
```

### Rate Limit Management
```typescript
// Automatic rate limit handling
const response = await client.request(query); // Waits if rate limited

// Manual rate limit checking
const rateLimitManager = container.get<IRateLimitManager>(GITHUB_TYPES.IRateLimitManager);
const canProceed = await rateLimitManager.canProceed();
const delay = await rateLimitManager.getDelay();
```

### Caching Control
```typescript
// Custom cache settings
const response = await client.request(query, variables, {
  cacheTTL: 600,           // 10 minutes
  cacheKey: 'custom-key',  // Custom cache key
  bypassCache: false       // Use cache if available
});

// Cache invalidation
const cacheManager = container.get<CacheManager>(CacheManager);
await cacheManager.invalidatePattern('github:repos:*');
```

### Webhook Processing
```typescript
const webhookProcessor = container.get<IWebhookProcessor>(GITHUB_TYPES.IWebhookProcessor);

// Register event handlers
webhookProcessor.on('push', async (event) => {
  console.log('Push event:', event.payload);
});

// Verify and process webhook
const isValid = webhookProcessor.verifySignature(payload, signature, secret);
if (isValid) {
  await webhookProcessor.processWebhook(headers, payload);
}
```

## Testing Guidelines

### Unit Tests
- Test each component in isolation with mocked dependencies
- Test error scenarios and edge cases
- Verify circuit breaker state transitions
- Test rate limit calculations and delays
- Test query routing decisions

### Integration Tests
- Test full request lifecycle with real GitHub API structure
- Test caching behavior across requests
- Test webhook processing end-to-end
- Test batch request processing
- Test metrics collection accuracy

### Test Structure
```typescript
describe('GitHubClient', () => {
  let client: IGitHubClient;
  let mockLogger: ILogger;
  let mockCache: ICache;
  
  beforeEach(() => {
    // Setup container with mocks
    const container = createGitHubContainer(config, mockLogger, mockCache);
    client = container.get<IGitHubClient>(GITHUB_TYPES.IGitHubClient);
  });
  
  it('should route simple queries to REST', async () => {
    // Test implementation
  });
});
```

## Integration Points

### With GitHub APIs
- **REST API**: Simple CRUD operations, webhook endpoints
- **GraphQL API**: Complex relationship queries, nested data fetching
- **Rate Limits**: Unified tracking across both API types
- **Authentication**: Personal Access Token with appropriate scopes

### With metaGOTHIC Services
```typescript
// In repo-agent-service
const client = container.get<IGitHubClient>(GITHUB_TYPES.IGitHubClient);

// Repository analysis
const repoData = await client.request(`
  query($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      languages(first: 10) { edges { node { name } } }
      pullRequests(states: OPEN, first: 20) { totalCount }
      issues(states: OPEN, first: 20) { totalCount }
    }
  }
`, { owner, name });

// Webhook handling
app.post('/webhooks/github', async (req, res) => {
  await webhookProcessor.processWebhook(req.headers, req.body);
  res.status(200).send('OK');
});
```

### With Caching Layer
```typescript
// Redis cache integration
class RedisCache implements ICache {
  async get<T>(key: string): Promise<T | null> {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  }
  
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await redis.setex(key, ttl, serialized);
    } else {
      await redis.set(key, serialized);
    }
  }
}
```

## Performance Considerations

### Query Optimization
- Simple queries automatically converted to REST for faster response
- GraphQL queries optimized with pagination limits
- Query complexity analysis prevents expensive operations

### Caching Strategy
- Repository data cached for 5 minutes (frequent updates)
- User data cached for 1 hour (less frequent changes)
- Issue/PR data cached for 2 minutes (very dynamic)
- Search results cached for 30 seconds (frequently changing)

### Rate Limit Optimization
- Separate tracking for REST vs GraphQL quotas
- Intelligent batching to maximize quota efficiency
- Exponential backoff for rate limit recovery
- Circuit breaker prevents quota exhaustion

## Error Handling

### Circuit Breaker States
- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Service degraded, requests rejected immediately
- **HALF_OPEN**: Testing recovery, limited requests allowed

### Common Error Scenarios
```typescript
try {
  const response = await client.request(query);
} catch (error) {
  if (error.message.includes('rate limit')) {
    // Rate limit exceeded - automatic retry
    await rateLimitManager.waitForReset();
  } else if (error.message.includes('Circuit breaker')) {
    // Service temporarily unavailable
    console.log('GitHub API temporarily unavailable');
  } else {
    // Other errors (network, auth, etc.)
    logger.error('GitHub request failed', error);
  }
}
```

### Webhook Security
- Always verify webhook signatures before processing
- Use constant-time comparison for signature verification
- Log all webhook processing attempts for security monitoring
- Handle malformed payloads gracefully

## Best Practices

### Query Design
1. **Use specific fields**: Only request data you need
2. **Implement pagination**: Use `first`/`last` parameters for lists
3. **Batch related queries**: Combine multiple operations when possible
4. **Cache expensive queries**: Use appropriate TTL for data volatility

### Rate Limit Management
1. **Monitor quotas**: Track remaining requests across API types
2. **Implement backoff**: Use exponential backoff for rate limit recovery
3. **Batch operations**: Group related API calls together
4. **Use webhooks**: Prefer real-time events over polling

### Error Handling
1. **Graceful degradation**: Continue operation with cached data when possible
2. **Circuit breaker**: Prevent cascading failures in service mesh
3. **Retry logic**: Implement intelligent retry with backoff
4. **Monitoring**: Track error rates and types for operational insights

## Common Issues & Solutions

### Issue: Rate limit exceeded frequently
**Solution**: Implement request batching and caching
```typescript
// Bad: Multiple individual requests
const repos = await Promise.all(
  repoNames.map(name => client.request(getRepoQuery, { name }))
);

// Good: Batch into single GraphQL query
const repos = await client.request(getBatchReposQuery, { names: repoNames });
```

### Issue: Webhook signature verification fails
**Solution**: Ensure proper payload handling
```typescript
// Bad: Using parsed JSON
const payload = JSON.stringify(req.body);

// Good: Use raw body
app.use('/webhook', express.raw({ type: 'application/json' }));
const payload = req.body.toString();
```

### Issue: Circuit breaker triggering too frequently
**Solution**: Adjust thresholds and timeout values
```typescript
const circuitBreaker = container.get<ICircuitBreaker>(GITHUB_TYPES.ICircuitBreaker);
// Configure appropriate failure threshold and timeout
```

## Package Principles
- **Smart Routing**: Automatically choose optimal GitHub API
- **Fault Tolerance**: Graceful degradation and recovery
- **Performance**: Aggressive caching and rate limit optimization
- **Security**: Secure webhook processing and token handling
- **Observability**: Comprehensive metrics and logging
- **Type Safety**: Full TypeScript support with strict types