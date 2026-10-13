# MASTER PLAN

## Objective and scope

A small B2B SaaS dashboard answering **"is this week normal for us?"** for calls, leads, and appointments — per account and per location — against each account's **own** historical activity. Monday-morning glanceable: current totals, a similar prior period, and a clear above / typical / below signal.

## Where would an LLM fit?

> TBD

## Stack and layout

**Layout:** npm workspaces monorepo, two apps.

```
backend/                    # NestJS + TypeScript + TypeORM
frontend/                   # Vite + React + TypeScript + Tailwind + shadcn/ui
PLAN.md                     # this master plan
docker-compose.yml          # db + backend + frontend; migrations & seed auto-run
schema.sql, seed.sql        # raw source of truth (untouched)
package.json                # npm workspaces: backend, frontend
```

- Runtime: Docker Compose (primary)
- Database: PostgreSQL 14, via Docker Compose db service
- Backend: NestJS + TypeScript
- DB access: TypeORM (entities, + migrations, pg driver)
- Frontend: Vite + React + TypeScript
- Styling Tailwind CSS + shadcn/ui
- Backend tests: Jest + Supertest (NestJS e2e)
- Frontend tests: Vitest + React Testing Library
- Seed: TypeScript seed process (backend/src/database/seed/)
- API style: REST, JSON
- Auth: out of scope

## Definitions and constants

| Constant           | Value | Description                                                                 |
| ------------------ | ----- | --------------------------------------------------------------------------- |
| BASELINE_WEEKS     | 8     | ~2 months of events, good median to have good balance noice/relevant events |
| MIN_BASELINE_WEEKS | 4     | usefull minimum otherwise data could be less relevant                       |
| MIN_BASELINE_OBS   | 3     | minimum non-zero same-weekday observations across baseline weeks            |
| NORMAL_BAND_PCT    | 30    | ~30% around baseline = "typical"; outside = above/below                     |

**For this dataset (fixtures):**

- Reporting period: **2026-07-20 → 2026-07-26** (last event day 2026-07-27 is a Monday → partial/truncated, excluded by the complete-week rule).
- Baseline period: **2026-05-25 → 2026-07-19** (8 weeks).

## Acceptance Criteria

These testable acceptance criteria map directly to the specification and phases. Each must be verifiable (evidence: tests, DB state, build output, manual verification notes).

**Traceability matrix — Spec section → Phase → AC group**

| Spec section | Phase | Acceptance criteria | Verified by |
| --- | --- | --- | --- |
| 1) Goal & requirements mapping | Phase 0 | AC-1.1, AC-1.2 | Plan review + recorded inspection findings |
| 2) Data model & persistence (TypeORM) | Phase 1 | AC-2.1 – AC-2.6 | Migration run + seed verification output |
| 3) Baseline vs comparison periods (correctness) | Phase 2 | AC-3.1 – AC-3.8 | Unit tests (BDD) + integration tests (Supertest) |
| 4) Backend API (NestJS + TypeORM) | Phase 2 | AC-4.1 – AC-4.6 | Integration tests (Supertest, API + DB) |
| 5) Frontend (React + TS + Tailwind + shadcn/ui) | Phase 3 | AC-5.1 – AC-5.7 | TS build + manual pass against live backend |
| 6) Testing (BDD) | Phase 4 | AC-6.1 – AC-6.6 | Test run output (unit / integration / E2E) |
| Delivery & docs | Phase 5 | AC-7.1 – AC-7.5 | Fresh-clone style README walkthrough |

Every test scenario written in Phase 4 must cite the AC it verifies (e.g. `AC-3.5`). Every AC must be checkable with evidence listed above — no criterion may be marked satisfied on assertion alone.

### AC-1: Spec compliance & planning (Phase 0)
- [x] **AC-1.1** PLAN.md preserved; deviations recorded in `Revisions and plan deviations` with rationale/impact/context. *(Sections retained; R1–R5 added under `Revisions and plan deviations`.)*
- [x] **AC-1.2** Data inspection completed (per-account timezone, created_at, locations, ranges, counts by event type, weeks of history) and recorded; assumptions (BASELINE_WEEKS/MIN_BASELINE_WEEKS/MIN_BASELINE_OBS/NORMAL_BAND_PCT/week start) validated/updated with evidence. *(See `### 1a) Data inspection findings`.)*
- [x] **AC-1.3** Monorepo scaffolds build: `npm run build` passes in backend and frontend. *(Verified: `npm run build` at root exit 0; `tsc --noEmit` clean for backend.)*
- [x] **AC-1.4** Docker compose config valid; frontend sanity page renders. *(Verified: `docker compose config` exit 0; `docker compose build` + `up -d` brought up db (healthy)/backend/frontend; `curl :3000/health` → 200 `{"status":"ok","phase":"scaffold"}`; `curl :5173` → 200; Vitest jsdom render test asserts the page mounts with shadcn Card/Button/Badge wired.)*
- [x] **AC-1.5** No business logic implementation before Phase 0 inspection complete. *(Only a scaffold `/health` endpoint exists; comparison logic is Phase 2.)*

### AC-2: Data model, migrations, seed (Phase 1)
- [x] **AC-2.1** TypeORM entities (Account, ActivityEvent) match schema exactly (types, nullability, PK/FK, relations Account 1:N ActivityEvent). *(Verified: `\d accounts` / `\d activity_events` in Postgres match `schema.sql` column-for-column — `timestamp without time zone`, correct varchar lengths, `duration_seconds`/`outcome` nullable, PK + FK. `outcome` deliberately left unconstrained per R4.)*
- [x] **AC-2.2** Migrations translate `schema.sql` to TypeORM; idempotent; committed. *(Verified: `InitialSchema1710000000000` applies cleanly; a second `migration:run` reports "No migrations are pending". `down` reverses it.)*
- [x] **AC-2.3** TypeScript seed preserves all data from `seed.sql`: 20 accounts, 12626 activity_events; values not regenerated/reordered/fabricated; order accounts before events. *(Verified two ways: `npm run seed:verify` compares the checked-in module to `seed.sql` field-by-field with a second, independently written parser; `npm run seed:verify-db` compares every row actually in Postgres to `seed.sql` as raw text. Both report an exact match. Accounts are inserted before events.)*
- [x] **AC-2.4** Seed verification asserts counts and spot-checks samples; fails fast on mismatch. *(Verified: the runner asserts both counts, referential integrity (orphan events), earliest/latest timestamps and named spot-checks (account 20, event id 1); it exits non-zero on any mismatch and refuses to mutate a partially-seeded database. Both verifier scripts were proven to actually fail by deliberately corrupting data — see R6.)*
- [x] **AC-2.5** Backend container runs `npm run migrate && npm run seed` against compose DB before `nest start`. *(Verified: compose `backend` command is `sh -c "npm run migration:run && npm run seed && node dist/main.js"`; container logs show migration → seed → Nest start in that order.)*
- [x] **AC-2.6** Fresh `docker compose up --build -d` succeeds with migrations applied and seed verified. *(Verified from a deleted volume: build + up, db healthy, backend logs "Seed verified: 20 accounts, 12626 activity events", `/health` → 200, and `seed:verify-db` against the containerised DB reports an exact match with `seed.sql`.)*

### AC-3: Baseline/comparison correctness (Phase 2)
- [ ] **AC-3.1** Boundaries computed in account-local time using IANA timezone; converted to UTC; week start (Monday) documented and applied consistently; inclusive/exclusive explicit.
- [ ] **AC-3.2** Reporting period is complete week before last event (fixture 2026-07-20 → 2026-07-26); baseline is previous 8 complete weeks (2026-05-25 → 2026-07-19).
- [ ] **AC-3.3** Comparison by event_type (call_received, lead_created, appointment_set); account-level and per-location; strict account scoping.
- [ ] **AC-3.4** Normal band ±30% (NORMAL_BAND_PCT); correct status mapping (typical/above/below) when baseline>0.
- [ ] **AC-3.5** Insufficient history: status "Not enough history" (no fabricated numbers) when baseline weeks < MIN_BASELINE_WEEKS or baseline observation slots < MIN_BASELINE_OBS; returned as structured state.
- [ ] **AC-3.6** Zero baseline: mean==0 and recent==0 → defined state (typical/no activity); mean==0 and recent>0 → Above with fallback display, no NaN/Infinity.
- [ ] **AC-3.7** Nulls handled (duration_seconds/outcome ignored for counts), gaps allowed, event types constrained; parameterized queries only.
- [ ] **AC-3.8** Multi-location: per-location scoped to account; account-level includes all locations.

### AC-4: Read-only API (Phase 2)
- [ ] **AC-4.1** `GET /accounts` returns sorted list (id,name,industry,timezone).
- [ ] **AC-4.2** `GET /accounts/:id` returns details (id,name,industry,timezone,created_at); 404 if not found.
- [ ] **AC-4.3** `GET /accounts/:id/locations` returns distinct locations sorted.
- [ ] **AC-4.4** `GET /accounts/:id/comparison` returns per event_type with recent count, baseline mean, diff pct or fallback, status, period context (account-local and UTC), baseline window; accepts `asOf` (optional, YYYY-MM-DD) and `eventTypes` filter (optional); 400 on bad params.
- [ ] **AC-4.5** `GET /accounts/:id/comparison/locations` returns per-location comparisons with same fields; supports `locations` filter; strict account scoping.
- [ ] **AC-4.6** Insufficient/zero-baseline returned as structured states (not 5xx); 404 for unknown account; controllers thin, services encapsulate logic; typed DTOs.

### AC-5: Frontend UI/UX (Phase 3)
- [ ] **AC-5.1** Account list links to detail.
- [ ] **AC-5.2** Account detail shows header and overall comparison panel ("Is this normal for us?") with reporting period label and per event type cards (recent, baseline mean, status badge, percent when applicable).
- [ ] **AC-5.3** Multi-location section shows per-location metrics; highlights Above/Below; sorted by status severity then location name.
- [ ] **AC-5.4** Required states: loading, error, empty, insufficient history, zero baseline.
- [ ] **AC-5.5** Real API integration (no mocks); network failures handled; typed API client; TS build clean.
- [ ] **AC-5.6** Tailwind + shadcn/ui; accessible primitives/semantic HTML; no `any`.
- [ ] **AC-5.7** Manual verification passes against live backend for: multi-location account, single-site account, zero-events account.

### AC-6: Testing (BDD, meaningful business rules) (Phase 4)
- [ ] **AC-6.1** Unit tests cover banding ±30%, zero-baseline fallbacks, insufficient history (MIN_BASELINE_WEEKS/MIN_BASELINE_OBS), timezone boundaries/Monday start/UTC conversion, multi-location scoping, strict account scoping.
- [ ] **AC-6.2** Integration tests (Supertest, API+DB) cover all endpoints, validation (400/404), strict scoping, structured states, deterministic with fixed dates/timezones.
- [ ] **AC-6.3** BDD specs in Gherkin-style (Given/When/Then), one spec file per rule group; each scenario maps to an acceptance criterion.
- [ ] **AC-6.4** E2E tests validate end-user flow ("Monday morning glanceable", overall + multi-location).
- [ ] **AC-6.5** Tests deterministic (seeded test data, fixed asOf/reporting dates, controlled timezones); no dependence on `now`.
- [ ] **AC-6.6** All tests pass; results reported (no unverified claims).

### AC-7: Delivery & docs (Phase 5)
- [ ] **AC-7.1** README.md updated with product summary, stack, local setup (PostgreSQL default), loading migrations and seed, timezone/UTC handling, baseline window, "normal" definition, comparison metric.
- [ ] **AC-7.2** README lists all runnable commands (dev/build/test/migrate/seed for root/workspaces), API endpoints summary, assumptions, trade-offs, deferred work, how to run tests.
- [ ] **AC-7.3** Docker flow documented: `migrate && seed` run before app start in compose; fresh `docker compose up --build` works.
- [ ] **AC-7.4** Fresh-clone style verification complete: following README from clean env, all services up, migrations+seed applied, backend endpoints serve, frontend renders, all tests pass.
- [ ] **AC-7.5** Assumptions, trade-offs, deferred work explicitly listed in README. Any deviations recorded under `Revisions and plan deviations`.


## Specification

### 1) Goal and requirements mapping

**Goal (from TICKET.md/DASH-247):** Help customers answer _"is this normal for us?"_ at a glance for recent inbound activity (calls, leads, appointments) without exporting data or calling their account manager. Focus on comparison against a baseline; multi-location matters; Monday-morning glanceability.

**Confirmed requirements:**
- Compare recent activity vs historical baseline (same account, own history).
- Support multi-location customers (per-location breakdown to spot which location needs attention).
- Read-only dashboard consumption (no alerting/notifications, no ML/forecasting — out of scope).
- Respect account timezones (IANA) and UTC storage; all `occurred_at` in UTC.
- Preserve supplied dataset (schema+seed) as-is; translate schema to TypeORM migrations, seed to TypeScript seed process.

**Assumptions to validate/record (not facts):**
- Minimum baseline observations: defined as 3 for non-zero same-week observation
- Baseline window: 8 weeks (BASELINE_WEEKS=8). Chosen as reasonable balance for ~12.6k events across 20 accounts given fixture date range. Treat as assumption until verified against per-account history distribution.
- Minimum baseline useful: 4 weeks (MIN_BASELINE_WEEKS) — if baseline < 4 weeks of history, treat as insufficient history (do not fabricate).
- Minimum baseline observations: 3 non-zero same-weekday observations across baseline weeks (MIN_BASELINE_OBS) to have a meaningful "typical" for that weekday pattern.
- "Normal" band: ±30% around baseline mean (NORMAL_BAND_PCT=30). Outside band → above/below; within → typical. This is a simple, explainable comparison (not ML). Treat as assumption and document rationale.
- Reporting period: last complete week before the last event date in seed (fixture: last event 2026-07-27 is a Monday; exclude partial/truncated → reporting week 2026-07-20 → 2026-07-26). This matches "Monday morning" glanceability (looking at prior complete week). Treat as fixture-derived assumption; strategy must generalize (compute from data/timezone) and be documented.
- Comparison basis: compare totals by event_type (call_received, lead_created, appointment_set) for the reporting period vs baseline mean for the same weekday-of-week pattern aligned to account-local time (to be precise about "this week" in account timezone).
- Band percentage: using 30% as threshold for when is "tipical" to "above/below"

### 1a) Data inspection findings (Phase 0, AC-1.2)

Evidence: parsed all rows of `seed.sql` (20 account INSERTs, 12626 activity_events INSERTs; counts asserted by a throwaway inspection script, not committed).

**Confirmed facts from the dataset:**
- 20 accounts, 12626 events. Event range UTC: `2026-02-01 10:57:44` → `2026-07-27 22:20:34`.
- Locations are labelled `Site A` … `Site O`. Per-account location counts range **1 → 15** (single-site: ids 8, 13, 16, 19; max: id 6 with 15 locations). This validates the multi-location requirement and gives ready fixtures for Phase 3 manual verification.
- **Account 20 (Quiet Harbor Spa, America/Los_Angeles) has zero events and zero locations.** This is the real "zero-events account" referenced in Phase 3 — no synthetic account is needed. It must render as an explicit empty/no-activity state, not an error.
- `event_type` values are exactly the three expected. `duration_seconds` is NULL for all non-call events (and for some calls). `outcome` has NULLs and values including values beyond those named in `schema.sql` comments (e.g. `open`, `completed`) — schema comment lists only examples, so no constraint beyond `varchar(40)`.
- Accounts with events all have ~25 weeks of history, far exceeding BASELINE_WEEKS=8.
- Weekday pattern is strongly seasonal: Sat ~584 and Sun ~578 events vs ~2112–2892 on weekdays. Weekday-aligned comparison (not a flat daily mean) is materially justified by the data.
- Fixture week math confirms the plan exactly: last event `2026-07-27` is a **Monday**; its week (07-27 → 08-02) is partial and excluded; previous complete week = **2026-07-20 → 2026-07-26**; 8 weeks before that = **2026-05-25 → 2026-07-19**. Monday-start weeks are therefore consistent with both the data and "Monday morning" in the ticket.

**Assumption validation:**
- `BASELINE_WEEKS = 8` — **supported.** All 19 accounts with events have complete coverage of all 8 baseline weeks (baseline week indices 0–7 all present); no account has a hole in the window.
- `MIN_BASELINE_OBS = 3` (non-zero weeks per account/location × event_type) — **supported and not over-strict.** Measured over the fixture window: **57/57** account × event_type pairs have ≥3 non-zero baseline weeks, and **204/207** location × event_type pairs do. Only 3 location×type pairs fall below the threshold and will correctly show "insufficient history". Notably the tightest location/type case still reaches 4/8 weeks, so the rule does not suppress the multi-location view.
- `MIN_BASELINE_WEEKS = 4` — **cannot trigger on the fixture dataset.** Every account has ~25 weeks of history, so insufficient-history will never fire for the default reporting window. It is reachable only when `asOf` shifts the reporting week back toward the data start (earliest event 2026-02-01), or in tests with synthetic data. Both must be covered in Phase 4.
- `NORMAL_BAND_PCT = 30` — **plausible but unvalidated; remains an assumption.** It is a product/UX judgement (how wide is "typical"), not derivable from the data. Noted as a trade-off to surface in the README.

**Amendments arising from inspection (see `Revisions and plan deviations`):**
- Week start is **Monday**, now evidenced rather than assumed.
- The zero-events case is a real seeded account (id 20), so Phase 3 must not "identify or create" one.

### 2) Data model and persistence (TypeORM)

**Entities (match schema exactly):**
- `Account` entity: `id` (integer PK), `name` varchar(120), `industry` varchar(60), `timezone` varchar(60) IANA, `created_at` timestamp (UTC). One-to-many `ActivityEvent[]`.
- `ActivityEvent` entity: `id` (integer PK), `account_id` FK→Account, `location` varchar(80), `event_type` enum or varchar constrained to {'call_received','lead_created','appointment_set'}, `occurred_at` timestamp (UTC), `duration_seconds` int nullable (calls only), `outcome` varchar(40) nullable. Indexes: (account_id, occurred_at), (account_id, location, occurred_at), (event_type) as needed for aggregation.

**Migrations:**
- Translate `schema.sql` DDL into TypeORM migration(s). Must reflect source schema exactly (types, nullability, FK). Idempotent structure; no manual schema sync in app code.
- Migration files committed; app runs migrations via TypeORM CLI/NestJS migration config.

**Seed (TypeScript):**
- Translate `seed.sql` into a TypeScript seed process (e.g., `backend/src/database/seed/`). Insert in dependency order (accounts before events). Preserve all original values/counts (do not regenerate/reorder arbitrarily/fabricate).
- Verification step on seed: assert counts (accounts==20, events ~12600) and spot-check samples; fail fast if mismatch. Treat seeded data as immutable reference.

### 3) Baseline vs comparison periods (correctness)

**Boundaries (critical):**
- All computations in UTC for storage; convert period boundaries to account-local using account IANA timezone when determining "week" alignment for that account (apples-to-apples). Document decision in PLAN.md.
- Reporting period = complete week ending before/at last complete week boundary relative to last event. Fixture: last event 2026-07-27 (Monday). Exclude partial → reporting 2026-07-20 → 2026-07-26. Define inclusive/exclusive explicitly.
- Baseline = previous N weeks (BASELINE_WEEKS=8) immediately before reporting period, same weekday alignment (rolling window of complete weeks), excluding the reporting week and any partial week.
- Week start: assume ISO week? Or Monday start (matches "Monday morning"). Document assumption (fixture context) and enforce consistently.

**Comparison metrics (per account/location):**
- For each (account, location?, event_type) compute `count_recent = events in reporting week`.
- Baseline: for same (account, location?, event_type) over baseline weeks, compute per same-weekday-of-week counts across baseline weeks → baseline mean `mean_baseline = mean of counts for matching weekday slots`.
- Define "normal": `mean_baseline == 0` → zero baseline case (see 3a). Else let `diff_pct = |count_recent - mean_baseline| / mean_baseline * 100`. `diff_pct <= NORMAL_BAND_PCT` → typical; `count_recent > mean_baseline and diff_pct > NORMAL_BAND_PCT` → above; `count_recent < mean_baseline and diff_pct > NORMAL_BAND_PCT` → below.

**3a) Edge cases:**
- **Insufficient history**: If baseline weeks available < MIN_BASELINE_WEEKS OR if baseline observation slots < MIN_BASELINE_OBS in relevant sense. Show explicit state "Not enough history" with guidance; never fabricate numbers.
- **Zero baselines**: If `mean_baseline == 0` and `count_recent == 0` → typical/no activity. If `mean_baseline == 0` and `count_recent > 0` → above with fallback display (e.g., "Above (was 0, now N)"), avoid NaN/Infinity.
- **No data in reporting period**: `count_recent == 0` vs baseline>0 → handle explicitly.
- **Nulls/messiness**: `duration_seconds` nullable (ignore for counts), `outcome` nullable, event types constrained, gaps possible. Scoping by account/location mandatory.
- **Multi-location**: Aggregation at account-level (overall) and per-location.

### 4) Backend API (NestJS + TypeORM)

**Read-only endpoints (dashboard):**
- `GET /accounts` — list accounts (id, name, industry, timezone). Sorted by name/id.
- `GET /accounts/:id` — account details + timezone + created_at.
- `GET /accounts/:id/locations` — distinct locations for account (sorted).
- `GET /accounts/:id/comparison` — overall comparison for account (all locations). Query: `?asOf=YYYY-MM-DD` (optional), `?eventTypes=call_received,lead_created,appointment_set` (optional). Returns per event_type with recent count, baseline mean, diff pct or fallback, status, period context, baseline window.
- `GET /accounts/:id/comparison/locations` — per-location comparison. Same query params + `?locations=...` (optional). Returns per-location comparisons.

**Design notes:**
- Modules: `AccountsModule`, `ActivityModule` (or combined), `ComparisonsModule`. Controllers thin; services encapsulate business logic.
- Validation: class-validator on params/query.
- DB access: TypeORM repositories/query builders; parameterized queries only. Prefer DB aggregation.
- Scoping: every query filters by `account_id`; location filters within same account.
- Errors: 400/404 as appropriate; insufficient/zero-baseline returned as structured states (not 500). Typed DTOs.

### 5) Frontend (React + TypeScript + Tailwind + shadcn/ui)

**Pages/views:**
- Account list (home) — cards/table linking to detail.
- Account detail — header (name, industry, timezone). Overall comparison panel ("Is this normal for us?") with reporting period label, per event type cards (count_recent, baseline mean, status badge, percent when applicable).
- Multi-location section — tabs/table with per-location metrics; highlight Above/Below; sort by severity then name.

**UX states (required):** loading, error, empty, insufficient history, zero baseline.
**Implementation:** Vite + React + TS, Tailwind + shadcn/ui, typed API client (real API), accessibility, avoid `any`.

### 6) Testing (BDD focus on meaningful business rules)

Focus BDD (Given/When/Then). Unit (calculation/timezone/scoping), integration (API+DB), E2E where validates user flow. Deterministic; run before claiming pass. One spec file per rule group; scenarios map to acceptance criteria.

Key rules: banding ±30%, zero-baseline fallbacks, insufficient history (MIN_BASELINE_WEEKS/OBS), timezone boundaries/Monday start, multi-location scoping, strict account scoping, structured states for edge cases.

## Phased implementation (incremental)

### Phase 0 - Scaffolding
- **Goal:** Clean repo foundation; apps build; docker-compose wired.
- **Covers:** AC-1 (planning) and AC-1.3 / AC-1.4 (scaffold + compose).
- **Status:** ✅ Complete.
- **Delivered:**
  - Root `package.json` (npm workspaces: `backend`, `frontend`) + `package-lock.json`.
  - `backend/` NestJS 11 + TypeScript: `AppModule`, scaffold `AppController` with `GET /health`, tsconfig (`rootDir: src`), `nest-cli.json`, Jest unit config + separate Supertest e2e config (`backend/test/`), multi-stage `Dockerfile`.
  - `frontend/` Vite 8 + React 19 + TS: Tailwind v4 via `@tailwindcss/vite`, shadcn/ui tokens in `src/index.css` (CSS-first), `cn` util, shadcn primitives `Button` / `Card` / `Badge` under `src/components/ui/`, `components.json` so `shadcn add` works later, sanity page `App.tsx`, Vitest + RTL + jsdom with a render test, multi-stage `Dockerfile` (build → nginx).
  - `docker-compose.yml`: `db` (postgres:14, healthcheck, named volume), `backend` (depends on healthy db), `frontend` (nginx-served build).
- **Tasks:**
  1. Inspect data (must): read seed ranges per account, locations, event distributions to confirm baseline/window assumptions; record findings in PLAN.md (assumptions updated if needed).
  2. Scaffold npm workspaces: backend (NestJS) and frontend (Vite+React+TS). 
  3. Wire Tailwind CSS + shadcn/ui into frontend; create minimal sanity page rendering.
  4. Add docker-compose.yml (postgres 14, backend, frontend). Configure env vars.
  5. **Verify:** `npm run build` in both apps succeeds; `docker compose config` valid; frontend sanity page renders in dev build. *(All verified — see AC-1.3 / AC-1.4 evidence.)*

**Deferred to Phase 1 (noted, not blocked):**
- The compose `backend` service currently runs `node dist/main.js` only. Phase 1 changes its command to `npm run migrate && npm run seed && node dist/main.js` (AC-2.5).
- TypeORM, `pg`, `class-validator`/`class-transformer` are intentionally **not** installed yet — they arrive with Phase 1/2 code that uses them. Keeping the Phase 0 dependency set honest means the scaffold build proves nothing but the scaffold.

### Phase 1 - Migration + Seeds
- **Goal:** Schema and data parity via TypeORM tooling.
- **Covers:** AC-2 (spec section 2).
- **Status:** ✅ Complete.
- **Delivered:**
  - Entities `Account` / `ActivityEvent` (one-to-many, composite indexes on `(account_id, occurred_at)` and `(account_id, location, occurred_at)` for the Phase 2 aggregations).
  - Migration `1710000000000-InitialSchema` — a literal translation of `schema.sql`, plus the two additive indexes (`schema.sql` declares none).
  - `data-source.ts` shared by the Nest app and the TypeORM CLI; session pinned to UTC via libpq options.
  - `pg-timestamp.ts` — UTC-correct handling of `timestamp without time zone` (see R6).
  - Seed artifacts: `scripts/generate-seed-data.mjs` (translates `seed.sql` → `seed-data.ts`), `scripts/verify-seed-data.mjs`, `scripts/verify-seeded-db.mjs`, and `seed/seed-runner.ts` (chunked inserts, verification, re-runnable).
  - Scripts: `migrate`, `seed`, `migration:run|revert|show`, `seed:generate`, `seed:verify`, `seed:verify-db`.
  - Compose backend command now runs migration → seed → start.
- **Tasks:**
  1. Create TypeORM entities matching schema exactly (Account, ActivityEvent) with relations, constraints, indexes.
  2. Generate/author TypeORM migrations that produce the same DDL as `schema.sql` (idempotent structure).
  3. Translate `seed.sql` into TypeScript data module + seed runner inserting all data in dependency order (accounts before events). Preserve values; verify counts (accounts==20, events~12626) and spot-check samples; fail fast on mismatch.
  4. Configure backend container to run `npm run migrate && npm run seed` against compose `db` before `nest start`.
  5. **Verify:** Fresh `docker compose up --build -d` completes; migrations applied; seed verified; DB state matches source intent. *(All verified — see AC-2.1 – AC-2.6 evidence.)*

**Notes for Phase 2:**
- Timestamps must be read through the registered UTC parser and written as literals; never round-trip these columns through a naive `Date` (R6).
- `typeorm` is pinned to the 0.3.x line and `@nestjs/typeorm` to 11.x on purpose: the `@nestjs/typeorm` 12.x release ships ESM-only and breaks the CommonJS Jest setup (R7).
- To reset a partially-seeded database (e.g. after a failed seed), run `docker compose down -v` — the seed runner intentionally refuses to repair partial state rather than deleting reference data.

### Phase 2 - Backend API implementation
- **Goal:** Read-only endpoints with computed comparisons.
- **Covers:** AC-3 (comparison correctness) and AC-4 (API surface) — spec sections 3 and 4.
- **Tasks:**
  1. Implement comparison service (timezone/boundary math, baseline mean by weekday pattern, banding, edge cases). Use TypeORM best practices (repositories/query builders, parameterized). 
  2. Implement endpoints: `/accounts`, `/accounts/:id`, `/accounts/:id/locations`, `/accounts/:id/comparison`, `/accounts/:id/comparison/locations` with validation and strict scoping.
  3. Return structured states for insufficient/zero-baseline (not 500). Typed DTOs.
  4. **Verify (BDD):** Unit tests for calculation/boundaries/scoping; integration tests (API+DB) for endpoints and edge cases. All scenarios pass; deterministic (fixed dates/timezones).

### Phase 3 - Frontend implementation
- **Goal:** Real API integration, dashboard views.
- **Covers:** AC-5 — spec section 5.
- **Tasks:**
  1. Create typed API client matching backend DTOs (share types if feasible).
  2. Build account list and account detail views with overall + multi-location comparison panels.
  3. Implement all required states (loading/error/empty/insufficient/zero-baseline). Use shadcn/ui components.
  4. Real API integration (no mocks). Handle failures.
  5. **Verify:** Manual pass against live backend for: a multi-location account, a single-site account, and the zero-events account (identify/create such case if needed based on data). TypeScript build clean. Accessibility/basic UX checks.

### Phase 4 - Testing & hardening
- **Goal:** Comprehensive BDD coverage of business rules; harden.
- **Covers:** AC-6 — spec section 6, and provides the verification evidence for AC-3 / AC-4 / AC-5.
- **Tasks:**
  1. Ensure acceptance criteria exist for all business rules (create if missing based on scope) — coverage check: every rule in spec section 3 and every endpoint in spec section 4 maps to at least one AC.
  2. Write unit tests for implemented calculations and edge cases (insufficient history, zero baseline, boundaries, scoping). 
  3. Write integration tests (Supertest) for API, one spec file per rule group in BDD/Gherkin style; map each scenario to acceptance criterion (cite the AC id in the spec description).
  4. Add E2E tests where they validate end-user flow ("Monday morning glanceable", overall+multi-location).
  5. **Verify:** All tests pass (unit/integration/E2E as configured). Deterministic. No unverified claims.

### Phase 5 - Delivery
- **Goal:** Documentation and fresh-clone verification.
- **Covers:** AC-7 (delivery & docs); final AC-1.1 check for recorded deviations.
- **Tasks:**
  1. Update `README.md` with: product summary, stack, local setup (DB choice PostgreSQL default), loading migrations and seed, run commands (dev/build/test/migrate/seed for root/workspaces), API endpoints summary, assumptions, trade-offs, deferred work, how to run tests.
  2. Document timezone handling, UTC storage, baseline window, "normal" definition, comparison metric.
  3. **Verify (fresh-clone style):** Following README setup steps from scratch (clean env) results in working app: `docker compose up --build` brings up all services, migrations+seed run, backend serves endpoints, frontend renders; all tests pass. Record any final assumptions/trade-offs.

## Non-functional constraints
- Preserve original PLAN.md; record deviations in `PLAN.md` under `Revisions and plan deviations` with rationale/impact/context (AC-1.1).
- Evidence-based: follow repo conventions; no mocks unless justified; no alerts/ML.
- Security: parameterized queries, account scoping enforced at service/DB layer.
- Determinism and testability throughout.

## Revisions and plan deviations

- **R1 — Week start: Monday (evidence-based).** Spec §3 previously left week start open ("assume ISO week? Or Monday start"). Inspection confirms the last seeded event (2026-07-27) is a Monday and that Monday-start weeks reproduce the planned fixture windows exactly (reporting 2026-07-20 → 2026-07-26, baseline 2026-05-25 → 2026-07-19). Decision: **Monday-start weeks**, aligned in account-local time then converted to UTC. *Impact:* none on the stated fixture dates; removes an open question for Phase 2.
- **R2 — Zero-events account is real, not synthetic.** Phase 3 task 5 said "identify/create such case if needed". Inspection found seeded account **20 (Quiet Harbor Spa)** has zero events and zero locations. *Impact:* Phase 3 must use account 20 and must not fabricate data. The empty-state path is therefore load-bearing for the seeded dataset, not hypothetical.
- **R3 — `MIN_BASELINE_WEEKS` is unreachable on this dataset.** All 19 accounts with events have ~25 weeks of history, so the insufficient-history rule cannot fire for the default reporting window. *Impact:* Phase 4 must cover it via `asOf` shifted toward the data start (2026-02-01) or synthetic fixtures; the manual Phase 3 walkthrough will not surface it. Recorded so this is not mistaken for a missed edge case.
- **R4 — `outcome` vocabulary is wider than `schema.sql` comments.** Observed values include `open` and `completed`, beyond those named in the schema comment. *Impact:* Phase 1 must keep `outcome` as unconstrained `varchar(40)` and must not add an enum/check based on the comment examples.
- **R5 — `duration_seconds` is NULL for all non-call events**, not merely "only meaningful for calls". *Impact:* no change to the entity shape (still nullable integer); recorded so Phase 2 does not attempt duration aggregations across event types.
- **R6 — Timestamps were silently shifted by the host time zone (bug found and fixed during Phase 1).** The first working seed stored `occurred_at` as `04:57:44` instead of the source `10:57:44`: node-postgres converts `timestamp without time zone` to and from JS `Date` using the **process** time zone (the host here was `America/Costa_Rica`, UTC-6). Two things made this dangerous: (a) the in-process assertion *passed*, because writing and reading were symmetric through the same lossy path, and (b) my first seed-module generator and its verifier were wrong in the *same* way (a double `slice(1,-1)` on already-unquoted values), so they agreed on corrupted data. *Fixes:* `src/database/pg-timestamp.ts` registers a UTC parser for OID 1114 (reads) and the seed writes timestamp literals rather than `Date` objects (writes); the generator uses strict `[^']*` capture groups and only collapses doubled quotes. *Guard-rails added:* `seed:verify` (module vs `seed.sql`, second parser strategy), `seed:verify-db` (Postgres raw text vs `seed.sql`, immune to host time zone), and both were proven to fail by deliberately corrupting data. *Impact:* Phase 2 must treat this as a live hazard — every timestamp read must go through the registered parser, and any new query should be checked with `seed:verify-db`-style raw-text comparison.
- **R7 — `@nestjs/typeorm` pinned to 11.x, `typeorm` pinned to 0.3.x.** Neither is the newest release on purpose: `@nestjs/typeorm` 12.x is ESM-only and Jest's CommonJS runtime cannot parse it (`SyntaxError: Unexpected token 'export'`), and `@nestjs/typeorm` peers on `typeorm ^0.3.0 || ^1.0.0-dev` rather than the `1.x` stable line. *Impact:* upgrading either requires moving Jest to ESM first; treat as a deliberate trade-off, not an oversight.
- **R8 — `tsBuildInfoFile` moved into `dist`.** With `incremental: true` and `prebuild: rimraf dist`, a stale buildinfo outside `dist` made `tsc` skip emitting newly added files (entities and migrations silently absent from the build output). *Impact:* none functionally; prevents a confusing "it compiled but the files are missing" failure.
- **R9 — Seed verification is deliberately two-staged.** The runner's own assertions are not sufficient evidence on their own, for the reason in R6. *Impact:* Phase 4 must keep `seed:verify` and `seed:verify-db` in the test/CI path rather than relying on the runner's exit code.
