import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Environment configuration, loaded once and validated (Phase 4).
 *
 * Two rules shape this module:
 *
 *  1. **Nothing is required.** Every setting has a working default, so a fresh
 *     clone runs with no `.env` file at all. `.env` is therefore an
 *     override mechanism, never a prerequisite.
 *  2. **Bad values fail loudly and together.** Listing every problem at once
 *     beats discovering them one restart at a time.
 *
 * A local `backend/.env` is loaded when present, and never overrides variables
 * that Compose or the shell already set (dotenv does not override by default),
 * so the same code works unchanged in the container.
 *
 * See `.env.example` for the documented set.
 */

const here = dirname(__filename);
const localEnvFile = join(here, '..', '..', '.env');

let dotenvLoaded = false;
function loadLocalEnvFile(): void {
  if (dotenvLoaded) return;
  dotenvLoaded = true;
  if (existsSync(localEnvFile)) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('dotenv').config({ path: localEnvFile });
  }
}

export interface Env {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_HOST: string;
  DATABASE_PORT: number;
  DATABASE_USER: string;
  DATABASE_PASSWORD: string;
  DATABASE_NAME: string;
  /** Database used by the integration tests; never the seeded reference one. */
  TEST_DATABASE_NAME: string;
  /** Target the Vite dev/preview server proxies `/api` to. */
  VITE_PROXY_TARGET: string;
}

const ALLOWED_NODE_ENV = ['development', 'production', 'test'] as const;

export const DEFAULTS = {
  NODE_ENV: 'development',
  PORT: 3000,
  DATABASE_HOST: 'localhost',
  DATABASE_PORT: 5432,
  DATABASE_USER: 'relay',
  DATABASE_PASSWORD: 'relay',
  DATABASE_NAME: 'relay',
  TEST_DATABASE_NAME: 'relay_test',
  VITE_PROXY_TARGET: 'http://localhost:3000',
} as const;

/** Human-readable name of the setting an error refers to. */
const LABELS: Record<keyof Env, string> = {
  NODE_ENV: 'NODE_ENV',
  PORT: 'PORT',
  DATABASE_HOST: 'DATABASE_HOST',
  DATABASE_PORT: 'DATABASE_PORT',
  DATABASE_USER: 'DATABASE_USER',
  DATABASE_PASSWORD: 'DATABASE_PASSWORD',
  DATABASE_NAME: 'DATABASE_NAME',
  TEST_DATABASE_NAME: 'TEST_DATABASE_NAME',
  VITE_PROXY_TARGET: 'VITE_PROXY_TARGET',
};

function integerFrom(
  raw: string | undefined,
  fallback: number,
  key: keyof Env,
  problems: string[],
): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    problems.push(
      `${LABELS[key]} must be an integer between 1 and 65535 (received "${raw}")`,
    );
    return fallback;
  }
  return value;
}

function textFrom(
  raw: string | undefined,
  fallback: string,
  key: keyof Env,
  problems: string[],
): string {
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (trimmed === '') {
    problems.push(`${LABELS[key]} must not be empty`);
    return fallback;
  }
  return trimmed;
}

export function readEnv(source: NodeJS.ProcessEnv = process.env): Env {
  loadLocalEnvFile();
  const problems: string[] = [];

  const nodeEnvRaw = (source.NODE_ENV ?? DEFAULTS.NODE_ENV).trim();
  if (!ALLOWED_NODE_ENV.includes(nodeEnvRaw as Env['NODE_ENV'])) {
    problems.push(
      `${LABELS.NODE_ENV} must be one of ${ALLOWED_NODE_ENV.join(', ')} (received "${nodeEnvRaw}")`,
    );
  }

  const env: Env = {
    NODE_ENV: ALLOWED_NODE_ENV.includes(nodeEnvRaw as Env['NODE_ENV'])
      ? (nodeEnvRaw as Env['NODE_ENV'])
      : DEFAULTS.NODE_ENV,
    PORT: integerFrom(source.PORT, DEFAULTS.PORT, 'PORT', problems),
    DATABASE_HOST: textFrom(
      source.DATABASE_HOST,
      DEFAULTS.DATABASE_HOST,
      'DATABASE_HOST',
      problems,
    ),
    DATABASE_PORT: integerFrom(
      source.DATABASE_PORT,
      DEFAULTS.DATABASE_PORT,
      'DATABASE_PORT',
      problems,
    ),
    DATABASE_USER: textFrom(
      source.DATABASE_USER,
      DEFAULTS.DATABASE_USER,
      'DATABASE_USER',
      problems,
    ),
    DATABASE_PASSWORD: textFrom(
      source.DATABASE_PASSWORD,
      DEFAULTS.DATABASE_PASSWORD,
      'DATABASE_PASSWORD',
      problems,
    ),
    DATABASE_NAME: textFrom(
      source.DATABASE_NAME,
      DEFAULTS.DATABASE_NAME,
      'DATABASE_NAME',
      problems,
    ),
    TEST_DATABASE_NAME: textFrom(
      source.TEST_DATABASE_NAME,
      DEFAULTS.TEST_DATABASE_NAME,
      'TEST_DATABASE_NAME',
      problems,
    ),
    VITE_PROXY_TARGET: textFrom(
      source.VITE_PROXY_TARGET,
      DEFAULTS.VITE_PROXY_TARGET,
      'VITE_PROXY_TARGET',
      problems,
    ),
  };

  if (problems.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n  - ${problems.join(
        '\n  - ',
      )}\n\nSee backend/.env.example for the supported values.`,
    );
  }

  return env;
}