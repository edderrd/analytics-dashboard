import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Plan/spec/test coherence (AC-6.3, AC-6.1).
 *
 * Gherkin feature files state the business rules; the executable specs carry
 * them. This suite fails when the three drift apart:
 *
 *  1. every .feature file declares the specs that implement it, and those files
 *     exist (so a rule cannot be documented by nothing);
 *  2. every `Scenario:` shares its significant terms with one of the specs it
 *     declares (so a documented rule cannot quietly stop being tested);
 *  3. every `@AC-x.y` tag used in a feature file exists in PLAN.md;
 *  4. every AC cited by any test exists in PLAN.md; and
 *  5. every AC in the AC-3/AC-4/AC-5 groups is cited by at least one test, so
 *     no acceptance criterion can quietly lose its coverage.
 *
 * Rule 5 is the one that matters most: it turns "the plan says we cover this"
 * into something mechanically checked rather than asserted.
 */

const backendRoot = join(__dirname, '..', '..');
const repoRoot = join(backendRoot, '..');
const featuresDir = join(backendRoot, 'test', 'features');
const planPath = join(repoRoot, 'PLAN.md');

function readSpecSources(roots: string[]): string {
  const files: string[] = [];

  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        walk(full);
      } else if (/(^|[.-])spec\.tsx?$/.test(entry.name)) {
        files.push(readFileSync(full, 'utf8'));
      }
    }
  };

  for (const root of roots) walk(root);
  return files.join('\n');
}

/** Every executable spec in the repository: backend unit/integration + frontend. */
const allSpecSources = readSpecSources([
  join(backendRoot, 'src'),
  join(backendRoot, 'test'),
  join(repoRoot, 'frontend', 'src'),
]);

const plan = readFileSync(planPath, 'utf8');

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'given', 'has',
  'in', 'is', 'it', 'its', 'of', 'on', 'or', 'then', 'that', 'the', 'their',
  'this', 'to', 'when', 'with', 'without', 'never', 'no', 'not', 'still', 'same',
  'own', 'whole', 'only', 'both', 'rather', 'than', 'into', 'over', 'one',
]);

function significantTerms(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
  );
}

interface FeatureFile {
  name: string;
  content: string;
  scenarios: string[];
  implementsSpec: string[];
}

function readFeatures(): FeatureFile[] {
  return readdirSync(featuresDir)
    .filter((name) => name.endsWith('.feature'))
    .map((name) => {
      const content = readFileSync(join(featuresDir, name), 'utf8');
      // Gherkin indents scenarios under the Feature, so allow leading space.
      const scenarios = [...content.matchAll(/^\s*Scenario:\s*(.+)$/gm)].map(
        (match) => match[1].trim(),
      );
      const implementsSpec = [
        ...content.matchAll(/^#\s*Implements:\s*(.+)$/gm),
      ].flatMap((match) =>
        match[1]
          .split(',')
          .map((path) => path.trim())
          .filter(Boolean),
      );
      return { name, content, scenarios, implementsSpec };
    });
}

const features = readFeatures();

describe('Spec, test and plan coherence (AC-6.3, AC-6.1)', () => {
  describe('Given the Gherkin feature files', () => {
    it('Then each rule group is documented', () => {
      expect(features.length).toBeGreaterThanOrEqual(5);
      expect(
        features.every((feature) => feature.scenarios.length > 0),
      ).toBe(true);
    });

    it('Then every feature declares the specs that implement it (AC-6.3)', () => {
      const missing: string[] = [];
      for (const feature of features) {
        if (feature.implementsSpec.length === 0) {
          missing.push(`${feature.name}: no "# Implements:" header`);
          continue;
        }
        for (const specPath of feature.implementsSpec) {
          if (!existsSync(join(repoRoot, specPath))) {
            missing.push(`${feature.name}: missing ${specPath}`);
          }
        }
      }
      expect(missing).toEqual([]);
    });

    it('Then every scenario is reflected in one of its implementing specs (AC-6.3)', () => {
      const undocumented: string[] = [];

      for (const feature of features) {
        const sources = feature.implementsSpec
          .map((path) => readFileSync(join(repoRoot, path), 'utf8'))
          .join('\n')
          .toLowerCase();

        for (const scenario of feature.scenarios) {
          const terms = significantTerms(scenario);
          const covered = [...terms].filter((term) => sources.includes(term)).length;
          // Two thirds of the distinctive words must appear in the specs.
          if (terms.size > 0 && covered / terms.size < 0.66) {
            undocumented.push(`${feature.name} :: ${scenario}`);
          }
        }
      }

      expect(undocumented).toEqual([]);
    });
  });

  describe('Given the acceptance criteria in PLAN.md', () => {
    it('Then every @AC tag used in a feature file exists in the plan', () => {
      const tagged = new Set<string>();
      for (const feature of features) {
        for (const match of feature.content.matchAll(/@(AC-\d+\.\d+)/g)) {
          tagged.add(match[1]);
        }
      }

      expect(tagged.size).toBeGreaterThan(0);
      const unknown = [...tagged].filter((id) => !plan.includes(`**${id}**`));
      expect(unknown).toEqual([]);
    });

    it('Then every AC cited by any test exists in the plan', () => {
      const cited = new Set<string>();
      for (const match of allSpecSources.matchAll(/AC-\d+\.\d+/g)) cited.add(match[0]);

      expect(cited.size).toBeGreaterThan(0);
      const unknown = [...cited].filter((id) => !plan.includes(`**${id}**`));
      expect(unknown).toEqual([]);
    });

    it('Then every acceptance criterion for comparison, API and UI is covered by a test (AC-6.1)', () => {
      const planIds = new Set(
        [...plan.matchAll(/\*\*(AC-[345]\.\d+)\*\*/g)].map((match) => match[1]),
      );
      expect(planIds.size).toBeGreaterThan(10);

      const uncovered = [...planIds].filter((id) => !allSpecSources.includes(id));
      expect(uncovered).toEqual([]);
    });
  });

  describe('Given the deterministic-testing requirement (AC-6.5)', () => {
    it('Then the integration setup pins the time zone and isolates the database', () => {
      const setup = readFileSync(join(backendRoot, 'test', 'setup-env.ts'), 'utf8');
      expect(setup).toContain('TZ');
      // The database name is configurable; what matters is that the suite is
      // pointed at the test database rather than the seeded reference one.
      expect(setup).toContain('TEST_DATABASE_NAME');
    });

    it('Then the default test database is not the seeded reference database', () => {
      // Guards the invariant that tests can never write to the dataset from
      // seed.sql, whatever someone configures.
      const config = readFileSync(join(backendRoot, 'src', 'config', 'env.ts'), 'utf8');
      const defaults = [
        ...config.matchAll(/(DATABASE_NAME|TEST_DATABASE_NAME):\s*'([^']+)'/g),
      ].map((match) => match[2]);
      expect(defaults.length).toBeGreaterThan(1);
      expect(new Set(defaults).size).toBe(defaults.length);
    });

    it('Then the test database is rebuilt for every run', () => {
      const script = readFileSync(
        join(backendRoot, 'scripts', 'setup-test-database.mjs'),
        'utf8',
      );
      expect(script).toMatch(/DROP DATABASE IF EXISTS/);
      expect(script).toMatch(/CREATE DATABASE/);
    });

    it('Then no spec depends on the current date to pick its reporting week', () => {
      // `asOf` is pinned in the fixtures; a spec that omitted it would follow
      // "now" and drift over time.
      const e2eDir = join(backendRoot, 'test');
      const specs = readdirSync(e2eDir).filter((name) =>
        name.endsWith('.e2e-spec.ts'),
      );
      for (const spec of specs) {
        const content = readFileSync(join(e2eDir, spec), 'utf8');
        expect(content).not.toMatch(/new Date\(\s*\)/);
        expect(content).not.toMatch(/Date\.now\(\)/);
      }
    });
  });
});