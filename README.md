# @chasenocap/github-graphql-client

Smart GitHub API client with GraphQL/REST routing, caching, and rate limiting.

## Features

- **Smart API Routing**: Automatically chooses between GitHub GraphQL and REST APIs based on query complexity
- **Multi-Layer Caching**: Redis and in-memory caching with configurable TTL
- **Rate Limit Management**: Intelligent rate limit tracking and automatic retry with exponential backoff
- **Circuit Breaker Pattern**: Protects against cascading failures with configurable thresholds
- **Webhook Processing**: Secure webhook signature verification and event handling
- **Comprehensive Metrics**: Request tracking, cache hit rates, and performance monitoring
- **TypeScript Support**: Full type safety with comprehensive interfaces
- **Dependency Injection**: Built with Inversify for modularity and testability

## Installation

```bash
npm install @chasenocap/github-graphql-client
```

## Quick Start

```typescript
import { createGitHubContainer, GITHUB_TYPES } from '@chasenocap/github-graphql-client';
import type { IGitHubClient } from '@chasenocap/github-graphql-client';

// Create container with dependencies
const container = createGitHubContainer(
  { token: 'your-github-token' },
  logger,
  cache
);

// Get client instance
const client = container.get<IGitHubClient>(GITHUB_TYPES.IGitHubClient);

// Use smart request routing
const response = await client.request(`
  query {
    repository(owner: "octocat", name: "Hello-World") {
      name
      description
      stargazerCount
    }
  }
`);

console.log(response.data);
```

## Smart Routing

The client automatically chooses the optimal API based on query characteristics:

```typescript
// Simple queries → REST API
const repo = await client.request(`
  query {
    repository(owner: "owner", name: "repo") {
      name
      description
    }
  }
`);

// Complex queries → GraphQL API
const issues = await client.request(`
  query {
    repository(owner: "owner", name: "repo") {
      issues(first: 100) {
        edges {
          node {
            title
            comments(first: 10) {
              edges {
                node {
                  body
                }
              }
            }
          }
        }
      }
    }
  }
`);
```

## Caching

Configure caching for improved performance:

```typescript
// Cache with custom TTL
const response = await client.request(query, variables, {
  cacheTTL: 600, // 10 minutes
  cacheKey: 'custom-key'
});

// Bypass cache
const fresh = await client.request(query, variables, {
  bypassCache: true
});
```

## Rate Limiting

Automatic rate limit management:

```typescript
// Client automatically handles rate limits
try {
  const response = await client.request(query);
  console.log(response.data);
} catch (error) {
  // Rate limit exceeded - client will retry automatically
  console.error('Request failed:', error);
}

// Check rate limit status
const rateLimitManager = container.get(GITHUB_TYPES.IRateLimitManager);
const canProceed = await rateLimitManager.canProceed();
```

## Batch Processing

Process multiple requests efficiently:

```typescript
const requests = [
  { query: 'query { repository(owner: "user1", name: "repo1") { name } }' },
  { query: 'query { repository(owner: "user2", name: "repo2") { name } }' },
  { query: 'query { repository(owner: "user3", name: "repo3") { name } }' }
];

const responses = await client.batch(requests);
responses.forEach((response, index) => {
  console.log(`Request ${index}:`, response.data);
});
```

## Webhook Processing

Handle GitHub webhooks securely:

```typescript
import { GITHUB_TYPES } from '@chasenocap/github-graphql-client';
import type { IWebhookProcessor } from '@chasenocap/github-graphql-client';

const webhookProcessor = container.get<IWebhookProcessor>(GITHUB_TYPES.IWebhookProcessor);

// Register event handlers
webhookProcessor.on('push', async (event) => {
  console.log('Push received:', event.payload);
  // Process push event
});

webhookProcessor.on('pull_request', async (event) => {
  console.log('PR received:', event.payload);
  // Process pull request event
});

// Process incoming webhook (e.g., in Express route)
app.post('/webhook', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const payload = JSON.stringify(req.body);
  
  // Verify signature
  const isValid = webhookProcessor.verifySignature(
    payload,
    signature,
    process.env.WEBHOOK_SECRET
  );
  
  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook
  try {
    const event = await webhookProcessor.processWebhook(req.headers, payload);
    res.status(200).send('OK');
  } catch (error) {
    res.status(400).send('Bad Request');
  }
});
```

## Metrics and Monitoring

Track performance and usage:

```typescript
// Get current metrics
const metrics = client.getMetrics();
console.log('Total requests:', metrics.totalRequests);
console.log('Cache hit rate:', (metrics.cacheHits / metrics.totalRequests) * 100);
console.log('Average response time:', metrics.averageResponseTime);

// Get metrics for specific time period
const metricsCollector = container.get<IMetricsCollector>(GITHUB_TYPES.IMetricsCollector);
const periodMetrics = metricsCollector.getMetricsForPeriod(
  new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
  new Date()
);
```

## Configuration

### Authentication

The client supports GitHub Personal Access Tokens:

```typescript
const config = {
  token: process.env.GITHUB_TOKEN,
  userAgent: 'my-app/1.0.0',
  baseUrl: 'https://api.github.com' // optional
};
```

### Cache Configuration

```typescript
// Custom cache implementation
class MyCache implements ICache {
  async get<T>(key: string): Promise<T | null> {
    // Your cache implementation
  }
  
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // Your cache implementation
  }
  
  async delete(key: string): Promise<void> {
    // Your cache implementation
  }
}

const container = createGitHubContainer(config, logger, new MyCache());
```

## Error Handling

The client provides comprehensive error handling:

```typescript
try {
  const response = await client.request(query);
  console.log(response.data);
} catch (error) {
  if (error.message.includes('rate limit')) {
    console.log('Rate limited - will retry automatically');
  } else if (error.message.includes('Circuit breaker')) {
    console.log('Service temporarily unavailable');
  } else {
    console.error('Request failed:', error);
  }
}
```

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
npm run test:coverage
```

### Linting

```bash
npm run lint
npm run lint:fix
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run the test suite
6. Submit a pull request

## License

MIT