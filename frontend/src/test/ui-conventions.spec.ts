import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guardrails for the UI conventions the plan requires (AC-5.6).
 *
 * These are static checks rather than behavioural tests: the rules being
 * protected are "no `any` in the source", "shadcn/ui primitives are available"
 * and "status colours are not left undefined", none of which a rendering test
 * would catch after someone edits a file.
 */

const srcDir = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules') continue;
      files.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

const files = sourceFiles(srcDir);
const read = (file: string) => readFileSync(file, 'utf8');

describe('UI conventions (AC-5.6)', () => {
  const SELF = join('test', 'ui-conventions.spec.ts');

it('Then no source file uses the any type', () => {
    // This file is excluded: it necessarily contains the pattern it hunts for.
    const offenders = files
      .filter((file) => !file.endsWith(SELF))
      .filter((file) => /:\s*any\b|<any>|as\s+any\b/.test(read(file)))
      .map((file) => file.replace(srcDir, 'src'));

    expect(offenders).toEqual([]);
  });

  it('Then the shadcn/ui primitives the dashboard relies on are present', () => {
    const uiDir = join(srcDir, 'components', 'ui');
    const primitives = readdirSync(uiDir).filter((name) => name.endsWith('.tsx'));

    expect(primitives).toEqual(
      expect.arrayContaining([
        'badge.tsx',
        'button.tsx',
        'card.tsx',
        'skeleton.tsx',
        'table.tsx',
      ]),
    );
  });

  it('Then shadcn/ui is configured so components can be added later', () => {
    const config = JSON.parse(read(join(srcDir, '..', 'components.json')));
    expect(config.style).toBe('new-york');
    expect(config.tailwind.cssVariables).toBe(true);
  });

  it('Then every comparison status has a visual treatment and an explanation', () => {
    const badge = read(join(srcDir, 'components', 'StatusBadge.tsx'));
    for (const status of ['above', 'below', 'typical', 'insufficient_history']) {
      expect(badge).toContain(`${status}:`);
    }
    // Every reason the API can return must be explained to the user.
    for (const reason of [
      'within_normal_band',
      'outside_normal_band',
      'zero_baseline_no_activity',
      'zero_baseline_new_activity',
      'not_enough_history',
      'not_enough_observations',
    ]) {
      expect(badge).toContain(reason);
    }
  });

  it('Then the API types mirror every status the backend can return', () => {
    const types = read(join(srcDir, 'api', 'types.ts'));
    for (const status of ['above', 'typical', 'below', 'insufficient_history']) {
      expect(types).toContain(`'${status}'`);
    }
    expect(types).toContain('filteredLocations');
  });
});