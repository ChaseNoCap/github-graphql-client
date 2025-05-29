import { Container } from 'inversify';
import 'reflect-metadata';
import type { ILogger } from '@chasenocap/logger';
import type { ICache } from '@chasenocap/cache';
import type { GitHubAuthConfig } from '../types/GitHubTypes.js';
export declare function createGitHubContainer(config: GitHubAuthConfig, logger: ILogger, cache: ICache): Container;
//# sourceMappingURL=GitHubContainer.d.ts.map