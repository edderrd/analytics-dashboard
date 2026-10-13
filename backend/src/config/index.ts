import { readEnv, type Env } from './env';

/**
 * The validated environment for this process.
 *
 * Throws at import time if a value is invalid, so a misconfigured deployment
 * fails immediately with a readable message instead of surfacing later as a
 * confusing database connection error.
 */
export const env: Env = readEnv();