# Relay analytics dashboard

A small B2B SaaS dashboard that answers one question at a glance: **"is this week normal for us?"**

For each customer it compares their latest complete week of inbound activity — calls, leads and
appointments — against **their own history**, at account level and per location, and labels each
metric *typical*, *above* or *below* with the reason. It is built for a customer admin opening it on
a Monday morning and wanting to act, not to export data.

- **Frontend:** React 19 + TypeScript, Vite, Tailwind CSS v4, shadcn/ui
- **Backend:** NestJS 11 + TypeScript, TypeORM, PostgreSQL 14
- **Tests:** Jest + Supertest (backend), Vitest + React Testing Library (frontend)
- **Repo layout:** npm workspaces monorepo (`backend/`, `frontend/`), Docker Compose for the stack

The product brief, ticket (DASH-247) and the supplied dataset live in [`PLAN.md`](./PLAN.md) — the
specification, the reasoning behind it, and every deviation recorded along the way.

---

## Quick start

Requires Docker and Docker Compose. **No configuration file is needed** — every setting has a
working default. This path installs nothing on your machine; `npm install` is only needed if you
want to run the apps, tests or scripts directly (see below).

```bash
docker compose up --build
```

That builds both apps, starts PostgreSQL, applies the migration, loads the seed dataset, and serves:

| Service  | URL                     |
| -------- | ----------------------- |
| Dashboard| http://localhost:5173   |
| API      | http://localhost:3000   |
| Database | `localhost:5432`        |

Migrations and seeding run automatically on every boot and are idempotent, so restarts are safe.

### Running without Docker for the apps

Useful for day-to-day development; PostgreSQL still comes from Compose.

```bash
docker compose up -d db       # just the database
npm install
npm run migrate               # build + apply migrations to the local database
npm run seed                  # load the dataset
npm run dev                   # backend :3000 (watch) and frontend :5173
```

The frontend proxies `/api` to the backend, so both run same-origin from the browser's point of view.

---

## Commands

### Repository root

| Command | What it does |
| --- | --- |
| `npm run dev` | Backend (watch) and frontend dev server together |
| `npm run build` | Build both workspaces |
| `npm test` | Backend unit tests, frontend tests, **and** backend integration tests |
| `npm run test:backend` | Backend unit tests only (no database needed) |
| `npm run test:frontend` | Frontend tests only (no backend needed) |
| `npm run test:e2e` | Backend integration tests (provisions its own test database) |
| `npm run verify` | Full check: seed verification, both builds, backend typecheck, all test suites |
| `npm run verify:live` | The above **plus** the opt-in live frontend suites (needs the stack running) |
| `npm run build:backend` / `npm run build:frontend` | Build one workspace |

### Backend

| Command | What it does |
| --- | --- |
| `npm run start:dev --workspace backend` | API with file watching |
| `npm run migrate --workspace backend` | Build, then apply pending migrations |
| `npm run migration:show --workspace backend` | List migrations and whether they have run |
| `npm run migration:revert --workspace backend` | Roll the last migration back |
| `npm run seed --workspace backend` | Load the dataset (skips if already present) |
| `npm run seed:generate --workspace backend` | Regenerate the seed module from `seed.sql` |
| `npm run seed:verify --workspace backend` | Check the seed module against `seed.sql`, field by field |
| `npm run seed:verify-db --workspace backend` | Check the **database** against `seed.sql` as raw text |
| `npm run lint --workspace backend` | Typecheck without emitting |

### Frontend

| Command | What it does |
| --- | --- |
| `npm run dev --workspace frontend` | Vite dev server on :5173 |
| `npm run build --workspace frontend` | Typecheck and build for production |
| `npm run preview --workspace frontend` | Serve the production build locally |
| `npm run test --workspace frontend` | Vitest suites |
| `npm run lint --workspace frontend` | Lint |

---

## Configuration

Configuration is **optional**. `.env.example` documents every supported variable in two places:

```bash
cp .env.example .env              # Docker Compose settings (ports, credentials)
cp backend/.env.example backend/.env   # backend settings, for running outside Compose
```

Everything has a default, so a fresh clone runs with no `.env` at all. A `backend/.env` is loaded
when present but **never overrides** variables already set by the environment, so Compose and shell
values always win. Values are validated at startup: an invalid port, an unknown `NODE_ENV` or a
blank credential fails immediately with a message naming the variable, rather than surfacing later
as a connection error.

The Compose `db` service and the backend derive their credentials from the same `DATABASE_*` names,
so the application cannot end up pointed at a different database than the one Compose created.

---

## How "normal" is decided

The rules live in `backend/src/modules/comparisons/` and are recorded, with their justification, in
[`PLAN.md`](./PLAN.md).

**Reporting period.** The latest *complete* Monday–Sunday week, resolved in the account's own IANA
time zone. `asOf` names a date inside the current, possibly incomplete week; the reporting week is
the one before it. The default `asOf` comes from the newest event in the data — never from the system
clock — so the dashboard is reproducible.

**Baseline.** The eight complete weeks immediately before the reporting week, compared as whole
weeks, each in account-local time.

**Status.** With `baselineMean` the mean events per baseline week:

| Condition | Status |
| --- | --- |
| `baselineMean == 0`, no activity this week | `typical` (reason `zero_baseline_no_activity`) |
| `baselineMean == 0`, activity this week | `above` (reason `zero_baseline_new_activity`) |
| `\|change\| ≤ 30%` | `typical` |
| `change > 30%` | `above` |
| `change < -30%` | `below` |
| Fewer than 4 complete weeks of history | `insufficient_history` (`not_enough_history`) |
| Fewer than 3 active baseline weeks | `insufficient_history` (`not_enough_observations`) |

A percentage is never reported against a zero baseline — there is no such thing as "∞% above
nothing". The API returns a structured state instead, never a fabricated number.

**Assumptions** (choices, not facts; all recorded in PLAN.md):

- Baseline window is 8 weeks. Supported by the data: every account with activity covers all eight.
- A minimum of 3 active baseline weeks is required. Measured against the dataset, this is not
  over-strict — 57/57 account-level and 204/207 location-level comparisons clear it.
- The ±30% band is a **product judgement**, not something derivable from the data. It is the main
  knob a stakeholder would want to tune.

---

## API

Read-only JSON. No authentication (explicitly out of scope for this exercise).

| Endpoint | Description |
| --- | --- |
| `GET /health` | Liveness check |
| `GET /accounts` | All accounts, sorted by name, with location counts |
| `GET /accounts/:id` | One account: industry, timezone, creation time, locations |
| `GET /accounts/:id/locations` | Distinct locations with recorded activity |
| `GET /accounts/:id/comparison` | Account-level comparison |
| `GET /accounts/:id/comparison/locations` | Per-location comparison |

Query parameters: `asOf=YYYY-MM-DD`, `eventTypes=call_received,lead_created`,
`locations=Site A,Site B`.

Unknown parameters, malformed dates, unknown event types and locations belonging to another account
are all rejected with `400`. Unknown accounts return `404`. Edge cases are always `200` with a
structured state — never a `5xx`.

```jsonc
// GET /accounts/6/comparison
{
  "accountId": 6,
  "accountName": "Metro Collision Centers",
  "periods": {
    "asOf": "2026-07-27",
    "timezone": "America/New_York",
    "reportingWeekStartLocal": "2026-07-20",
    "reportingWeekEndLocal": "2026-07-26",
    "baselineWindowStartLocal": "2026-05-25",
    "baselineWindowEndLocal": "2026-07-19",
    "baselineWeeks": 8
  },
  "hasActivity": true,
  "locations": ["Site A", "…"],
  "filteredLocations": null,
  "totals": [
    {
      "eventType": "call_received",
      "recentCount": 51,
      "baselineMean": 102.3,
      "changePct": -50.1,
      "status": "below",
      "reason": "outside_normal_band",
      "baselineNonZeroWeeks": 8,
      "availableBaselineWeeks": 8
    }
  ]
}
```

---

## Data and time zones

`schema.sql` and `seed.sql` are the source of truth and are never modified. `schema.sql` is
translated into a TypeORM migration, and `seed.sql` into a checked-in TypeScript module plus a seed
runner that inserts accounts before events.

- All timestamps are stored as **UTC wall-clock values with no time zone**, exactly as in the source.
- Each account carries its own IANA time zone; week boundaries are resolved **in that zone** first
  and only then converted to UTC for querying.
- Two guards exist because getting this wrong is easy and silent: reads go through a registered UTC
  parser, and writes and query windows are bound as UTC literals rather than JS `Date` objects.
- The seed is verified two ways — the module against `seed.sql` with an independent parser, and the
  database against `seed.sql` as raw text, which is immune to the host's time zone.

The dataset (20 accounts, 12,626 events, February–July 2026) is treated as immutable reference data.
Tests never write to it: integration tests use a separate `relay_test` database that is dropped,
migrated and re-seeded on every run.

---

## Testing

```bash
npm install                 # required once; the Compose quick start does not need it
docker compose up -d db     # integration tests need a database

npm test                    # everything: backend unit + frontend + backend integration
npm run verify              # the above, plus builds, typecheck and seed verification
npm run verify:live         # the above, plus the live frontend suites
```

`npm run verify` and `npm run verify:live` build the backend, so they take slightly longer than
`npm test` on a cold run.

The live suites render the real components against a running backend instead of a stub:

```bash
docker compose up --build
RELAY_LIVE_API=1 npm test --workspace frontend
```

They are opt-in so that the default `npm test` stays hermetic and needs nothing running.

| Suite | Count | Needs |
| --- | --- | --- |
| Backend unit (jest) | 63 | nothing |
| Frontend (vitest) | 15 | nothing |
| Frontend live (vitest) | 27 | the running stack |
| Backend integration (Supertest) | 62 | a reachable database |

Business rules are documented as Gherkin features in `backend/test/features/`, and a coherence test
fails the build if a feature loses its implementing specs, if a scenario stops being covered, or if
an acceptance criterion in `PLAN.md` is no longer referenced by any test.

Determinism is enforced rather than assumed: tests pin `TZ=UTC` and `asOf`, and a test asserts that
no spec reads the current date.

---

## Trade-offs

Honest notes on the choices made, including the ones I would revisit.

- **Quiet weeks count towards the baseline mean.** The mean is taken across all eight baseline weeks,
  including weeks with no events, because a silent week is part of what "normal" looks like for that
  account. Excluding them would raise every baseline and make "above" far too easy to trigger — the
  more flattering and less honest option. This choice moves every reported `baselineMean`.
- **A zero baseline surfaces as "not enough history", not "new activity".** `MIN_BASELINE_OBS`
  rejects a baseline with no active weeks before the zero-baseline branch runs, so the API never
  emits `zero_baseline_new_activity`. The behaviour is defensible and nothing is fabricated, but for a
  metric that never happens at a customer, *"this is new"* would be the more useful answer. Changing
  it is a product decision, recorded as an open question in `PLAN.md` (R20).
- **A native `<select>` for the location picker** rather than the Radix-based shadcn Select: it is
  keyboard- and screen-reader-native with no extra ARIA wiring and behaves reliably under jsdom,
  which mattered because the filter had to be tested on both sides (R15).
- **One database query per comparison request**, aggregated in SQL but bucketed by account-local day.
  Timezone-aware week bucketing is not expressible cleanly and portably in SQL, so only the ~63 daily
  buckets are mapped to weeks in the application.
- **TypeORM 0.3.x with `@nestjs/typeorm` 11.x**, not the newest releases. The 12.x line is ESM-only
  and breaks the CommonJS Jest setup; upgrading means moving Jest to ESM first (R7).
- **Colour signals movement, not judgement.** "Above normal" is green and "Below normal" amber, but
  for an inbound-activity business more calls is not unambiguously good news.

Two real defects were found by the test suite rather than by inspection, both documented in
`PLAN.md`: daily bucketing briefly computed the UTC date instead of the account-local date (R18),
and query windows bound as JS `Date` objects silently shifted by the host's time zone (R19). Both
only became visible once tests covered events near local midnight and once the host was not UTC.

---

## Deferred work

Deliberately out of scope for this exercise, listed so the boundaries are explicit:

- **No authentication or multi-tenancy.** Every customer shares one deployment.
- **No alerting or notifications** — explicitly excluded by product.
- **No forecasting or ML** — explicitly excluded by product. The comparison is a fixed-band rule
  chosen so it can be explained to a customer in one sentence.
- **No date-range picker or historical trend view.** The dashboard answers one question about the
  latest complete week; exploring past weeks is the natural next step.
- **Only event counts are compared.** `duration_seconds` and `outcome` are stored and carried through
  the schema but never aggregated; comparing call quality would be a different question.
- **No caching or background jobs.** At this data volume a single query per request is the simplest
  thing that works.
- **The baseline window and band are constants, not per-customer settings.**
- **The seed is loaded synchronously on boot**, which is fine for 12k rows and would need a batched
  loader for a real dataset.

---

## Project layout

```
backend/                NestJS API
  src/config/           Validated environment configuration (defaults for everything)
  src/database/         Entities, migrations, seed module and runner, UTC timestamp handling
  src/modules/          Comparisons module (periods, banding, edge cases) and DTOs
  src/common/dates/     Local-calendar and IANA time-zone helpers
  test/                 Supertest suites + Gherkin feature files
frontend/               React dashboard
  src/api/              Typed client and DTO mirror
  src/components/       Comparison panels, status badges, UI states, shadcn primitives
  src/pages/            Account list and account detail
  src/test/             Vitest suites, including the opt-in live ones
docs/                   Product background and the original ticket (context, not built)
PLAN.md                 Specification, acceptance criteria, phased plan, deviations
AGENTS.md               Instructions for AI coding agents working in this repository
scripts/verify.mjs      Single verification entry point
```

`PLAN.md` is the reference for design decisions, acceptance criteria and the full list of recorded
deviations — start there if you want to understand *why* something is the way it is.