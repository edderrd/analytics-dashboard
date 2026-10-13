import { DEFAULTS, readEnv } from './env';

/**
 * The configuration contract (Phase 4): zero-config must work, and invalid
 * values must fail loudly.
 */

describe('Environment configuration', () => {
  describe('Given no environment variables at all', () => {
    it('Then every setting falls back to its default (AC-6.5)', () => {
      const env = readEnv({});

      expect(env).toEqual({
        NODE_ENV: DEFAULTS.NODE_ENV,
        PORT: DEFAULTS.PORT,
        DATABASE_HOST: DEFAULTS.DATABASE_HOST,
        DATABASE_PORT: DEFAULTS.DATABASE_PORT,
        DATABASE_USER: DEFAULTS.DATABASE_USER,
        DATABASE_PASSWORD: DEFAULTS.DATABASE_PASSWORD,
        DATABASE_NAME: DEFAULTS.DATABASE_NAME,
        TEST_DATABASE_NAME: DEFAULTS.TEST_DATABASE_NAME,
        VITE_PROXY_TARGET: DEFAULTS.VITE_PROXY_TARGET,
      });
    });

    it('Then the defaults point at the same database Compose creates by default', () => {
      const env = readEnv({});
      // Guards against the default drifting away from docker-compose.yml.
      expect(env.DATABASE_USER).toBe('relay');
      expect(env.DATABASE_PASSWORD).toBe('relay');
      expect(env.DATABASE_NAME).toBe('relay');
      expect(env.DATABASE_PORT).toBe(5432);
    });

    it('Then the test database is never the seeded reference database', () => {
      const env = readEnv({});
      expect(env.TEST_DATABASE_NAME).not.toBe(env.DATABASE_NAME);
    });
  });

  describe('Given a complete environment', () => {
    const complete = {
      NODE_ENV: 'production',
      PORT: '4000',
      DATABASE_HOST: 'db',
      DATABASE_PORT: '6543',
      DATABASE_USER: 'someone',
      DATABASE_PASSWORD: 'secret',
      DATABASE_NAME: 'analytics',
      TEST_DATABASE_NAME: 'analytics_test',
      VITE_PROXY_TARGET: 'http://api:3000',
    };

    it('Then every value is used as given', () => {
      const env = readEnv(complete);

      expect(env).toEqual({
        NODE_ENV: 'production',
        PORT: 4000,
        DATABASE_HOST: 'db',
        DATABASE_PORT: 6543,
        DATABASE_USER: 'someone',
        DATABASE_PASSWORD: 'secret',
        DATABASE_NAME: 'analytics',
        TEST_DATABASE_NAME: 'analytics_test',
        VITE_PROXY_TARGET: 'http://api:3000',
      });
    });

    it('Then numeric settings are parsed as numbers, not strings', () => {
      const env = readEnv(complete);
      expect(typeof env.PORT).toBe('number');
      expect(typeof env.DATABASE_PORT).toBe('number');
    });
  });

  describe('Given invalid values', () => {
    it('Then a non-numeric PORT is rejected and the variable is named', () => {
      expect(() => readEnv({ PORT: 'http' })).toThrow(/PORT must be an integer/);
    });

    it('Then an out-of-range port is rejected', () => {
      expect(() => readEnv({ DATABASE_PORT: '70000' })).toThrow(
        /DATABASE_PORT must be an integer/,
      );
    });

    it('Then an unknown NODE_ENV is rejected', () => {
      expect(() => readEnv({ NODE_ENV: 'staging' })).toThrow(
        /NODE_ENV must be one of/,
      );
    });

    it('Then an empty required value is rejected rather than silently defaulted', () => {
      expect(() => readEnv({ DATABASE_USER: '   ' })).toThrow(
        /DATABASE_USER must not be empty/,
      );
    });

    it('Then all problems are reported together, not one per restart', () => {
      let message = '';
      try {
        readEnv({ PORT: 'nope', NODE_ENV: 'staging', DATABASE_USER: '' });
      } catch (error) {
        message = error instanceof Error ? error.message : '';
      }

      expect(message).toMatch(/PORT/);
      expect(message).toMatch(/NODE_ENV/);
      expect(message).toMatch(/DATABASE_USER/);
      expect(message).toMatch(/\.env\.example/);
    });
  });

  describe('Given whitespace around a value', () => {
    it('Then it is trimmed rather than treated as part of the value', () => {
      expect(readEnv({ DATABASE_HOST: '  db  ' }).DATABASE_HOST).toBe('db');
    });
  });
});