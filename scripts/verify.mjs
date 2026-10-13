#!/usr/bin/env node
/**
 * One command that runs every check, in dependency order (Phase 4).
 *
 * Usage:
 *   npm run verify            # build, lint, unit, integration, frontend
 *   npm run verify -- --live # additionally runs the opt-in live frontend suites
 *
 * Exits non-zero on the first failure, and prints a short summary so a green
 * run is evidence rather than an assumption.
 */
import { spawnSync } from 'node:child_process';

const repoRoot = new URL('..', import.meta.url).pathname;
const live = process.argv.includes('--live');

const steps = [
  { name: 'seed module matches seed.sql', cmd: 'npm', args: ['run', 'seed:verify', '--workspace', 'backend'] },
  { name: 'build backend', cmd: 'npm', args: ['run', 'build', '--workspace', 'backend'] },
  { name: 'build frontend', cmd: 'npm', args: ['run', 'build', '--workspace', 'frontend'] },
  { name: 'typecheck backend', cmd: 'npm', args: ['run', 'lint', '--workspace', 'backend'] },
  { name: 'backend unit tests', cmd: 'npm', args: ['test', '--workspace', 'backend'] },
  {
    name: 'backend integration tests',
    cmd: 'npm',
    args: ['run', 'test:e2e', '--workspace', 'backend'],
  },
  { name: 'frontend tests', cmd: 'npm', args: ['test', '--workspace', 'frontend'] },
];

if (live) {
  steps.push({
    name: 'frontend live suites (needs docker compose up)',
    cmd: 'npx',
    args: ['vitest', 'run', '--root', 'frontend'],
    env: { RELAY_LIVE_API: '1', VITE_API_BASE_URL: process.env.VITE_API_BASE_URL ?? 'http://localhost:3000' },
  });
}

const results = [];

for (const step of steps) {
  process.stdout.write(`\n=== ${step.name} ===\n`);
  const outcome = spawnSync(step.cmd, step.args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...(step.env ?? {}) },
  });
  const ok = outcome.status === 0;
  results.push({ name: step.name, ok });
  if (!ok) break;
}

console.log('\n--- verification summary ---');
for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}`);
}

const skipped = steps.length - results.length;
if (skipped > 0) console.log(`SKIP  ${skipped} step(s) not reached`);

process.exit(results.every((result) => result.ok) ? 0 : 1);