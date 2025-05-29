import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from 'inversify';
import { QueryRouter } from '../../src/routing/QueryRouter.js';
import { GITHUB_TYPES } from '../../src/types/InjectionTokens.js';
import type { ILogger } from '@chasenocap/logger';

describe('QueryRouter', () => {
  let queryRouter: QueryRouter;
  let mockLogger: ILogger;

  beforeEach(() => {
    const container = new Container();
    
    mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {}
    } as ILogger;

    container.bind<ILogger>(GITHUB_TYPES.ILogger).toConstantValue(mockLogger);
    container.bind(QueryRouter).toSelf();

    queryRouter = container.get(QueryRouter);
  });

  describe('shouldUseGraphQL', () => {
    it('should use GraphQL for complex queries', () => {
      const complexQuery = `
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
      `;

      expect(queryRouter.shouldUseGraphQL(complexQuery)).toBe(true);
    });

    it('should use REST for simple queries', () => {
      const simpleQuery = `
        query {
          repository(owner: "owner", name: "repo") {
            name
            description
          }
        }
      `;

      expect(queryRouter.shouldUseGraphQL(simpleQuery)).toBe(false);
    });

    it('should use GraphQL for multi-resource queries', () => {
      const multiResourceQuery = `
        query {
          repository(owner: "owner", name: "repo") {
            name
          }
          user(login: "username") {
            name
          }
        }
      `;

      expect(queryRouter.shouldUseGraphQL(multiResourceQuery)).toBe(true);
    });
  });

  describe('convertToRest', () => {
    it('should convert repository query to REST', () => {
      const query = 'query { repository(owner: "octocat", name: "Hello-World") { name } }';
      const result = queryRouter.convertToRest(query);

      expect(result).toEqual({
        method: 'GET',
        path: '/repos/octocat/Hello-World'
      });
    });

    it('should convert user query to REST', () => {
      const query = 'query { user(login: "octocat") { name } }';
      const result = queryRouter.convertToRest(query);

      expect(result).toEqual({
        method: 'GET',
        path: '/users/octocat'
      });
    });

    it('should return null for non-convertible queries', () => {
      const query = 'query { viewer { login } }';
      const result = queryRouter.convertToRest(query);

      expect(result).toBeNull();
    });
  });

  describe('analyzeComplexity', () => {
    it('should calculate query depth correctly', () => {
      const query = `
        query {
          repository {
            issues {
              comments {
                body
              }
            }
          }
        }
      `;

      const complexity = queryRouter.analyzeComplexity(query);
      expect(complexity.depth).toBeGreaterThan(3);
    });

    it('should calculate query breadth correctly', () => {
      const query = `
        query {
          repository { name }
          user { login }
          organization { name }
        }
      `;

      const complexity = queryRouter.analyzeComplexity(query);
      expect(complexity.breadth).toBe(3);
    });

    it('should estimate cost for search queries', () => {
      const query = 'query { search(query: "test", type: REPOSITORY) { repositoryCount } }';
      const complexity = queryRouter.analyzeComplexity(query);
      
      expect(complexity.estimatedCost).toBeGreaterThan(10);
    });
  });

  describe('optimizeQuery', () => {
    it('should remove unnecessary whitespace', () => {
      const query = `
        query   {
          repository   (   owner:   "test"   )   {
            name
          }
        }
      `;

      const result = queryRouter.optimizeQuery(query);
      expect(result.query).not.toContain('   ');
    });

    it('should add pagination limits to edge queries', () => {
      const query = 'query { repository { issues { edges { node { title } } } } }';
      const result = queryRouter.optimizeQuery(query);
      
      expect(result.query).toContain('first: 100');
    });

    it('should preserve existing pagination', () => {
      const query = 'query { repository { issues(first: 50) { edges { node { title } } } } }';
      const result = queryRouter.optimizeQuery(query);
      
      expect(result.query).toContain('first: 50');
      expect(result.query).not.toContain('first: 100');
    });
  });
});