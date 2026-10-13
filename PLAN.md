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
- [ ] **AC-1.1** PLAN.md preserved; deviations recorded in `Revisions and plan deviations` with rationale/impact/context.
- [ ] **AC-1.2** Data inspection completed (per-account timezone, created_at, locations, ranges, counts by event type, weeks of history) and recorded; assumptions (BASELINE_WEEKS/MIN_BASELINE_WEEKS/MIN_BASELINE_OBS/NORMAL_BAND_PCT/week start) validated/updated with evidence.
- [ ] **AC-1.3** Monorepo scaffolds build: `npm run build` passes in backend and frontend.
- [ ] **AC-1.4** Docker compose config valid; frontend sanity page renders.
- [ ] **AC-1.5** No business logic implementation before Phase 0 inspection complete.

### AC-2: Data model, migrations, seed (Phase 1)
- [ ] **AC-2.1** TypeORM entities (Account, ActivityEvent) match schema exactly (types, nullability, PK/FK, relations Account 1:N ActivityEvent).
- [ ] **AC-2.2** Migrations translate `schema.sql` to TypeORM; idempotent; committed.
- [ ] **AC-2.3** TypeScript seed preserves all data from `seed.sql`: 20 accounts, 12626 activity_events; values not regenerated/reordered/fabricated; order accounts before events.
- [ ] **AC-2.4** Seed verification asserts counts and spot-checks samples; fails fast on mismatch.
- [ ] **AC-2.5** Backend container runs `npm run migrate && npm run seed` against compose DB before `nest start`.
- [ ] **AC-2.6** Fresh `docker compose up --build -d` succeeds with migrations applied and seed verified.

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
- **Tasks:**
  1. Inspect data (must): read seed ranges per account, locations, event distributions to confirm baseline/window assumptions; record findings in PLAN.md (assumptions updated if needed).
  2. Scaffold npm workspaces: backend (NestJS) and frontend (Vite+React+TS). 
  3. Wire Tailwind CSS + shadcn/ui into frontend; create minimal sanity page rendering.
  4. Add docker-compose.yml (postgres 14, backend, frontend). Configure env vars.
  5. **Verify:** `npm run build` in both apps succeeds; `docker compose config` valid; frontend sanity page renders in dev build.

### Phase 1 - Migration + Seeds
- **Goal:** Schema and data parity via TypeORM tooling.
- **Covers:** AC-2 (spec section 2).
- **Tasks:**
  1. Create TypeORM entities matching schema exactly (Account, ActivityEvent) with relations, constraints, indexes.
  2. Generate/author TypeORM migrations that produce the same DDL as `schema.sql` (idempotent structure).
  3. Translate `seed.sql` into TypeScript data module + seed runner inserting all data in dependency order (accounts before events). Preserve values; verify counts (accounts==20, events~12626) and spot-check samples; fail fast on mismatch.
  4. Configure backend container to run `npm run migrate && npm run seed` against compose `db` before `nest start`.
  5. **Verify:** Fresh `docker compose up --build -d` completes; migrations applied; seed verified; DB state matches source intent.

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
- None yet. All items above are planned; any significant deviation must be recorded here with rationale, impact, and approval context.
