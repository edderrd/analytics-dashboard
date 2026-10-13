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
- **Tasks:**
  1. Inspect data (must): read seed ranges per account, locations, event distributions to confirm baseline/window assumptions; record findings in PLAN.md (assumptions updated if needed).
  2. Scaffold npm workspaces: backend (NestJS) and frontend (Vite+React+TS). 
  3. Wire Tailwind CSS + shadcn/ui into frontend; create minimal sanity page rendering.
  4. Add docker-compose.yml (postgres 14, backend, frontend). Configure env vars.
  5. **Verify:** `npm run build` in both apps succeeds; `docker compose config` valid; frontend sanity page renders in dev build.

### Phase 1 - Migration + Seeds
- **Goal:** Schema and data parity via TypeORM tooling.
- **Tasks:**
  1. Create TypeORM entities matching schema exactly (Account, ActivityEvent) with relations, constraints, indexes.
  2. Generate/author TypeORM migrations that produce the same DDL as `schema.sql` (idempotent structure).
  3. Translate `seed.sql` into TypeScript data module + seed runner inserting all data in dependency order (accounts before events). Preserve values; verify counts (accounts==20, events~12626) and spot-check samples; fail fast on mismatch.
  4. Configure backend container to run `npm run migrate && npm run seed` against compose `db` before `nest start`.
  5. **Verify:** Fresh `docker compose up --build -d` completes; migrations applied; seed verified; DB state matches source intent.

### Phase 2 - Backend API implementation
- **Goal:** Read-only endpoints with computed comparisons.
- **Tasks:**
  1. Implement comparison service (timezone/boundary math, baseline mean by weekday pattern, banding, edge cases). Use TypeORM best practices (repositories/query builders, parameterized). 
  2. Implement endpoints: `/accounts`, `/accounts/:id`, `/accounts/:id/locations`, `/accounts/:id/comparison`, `/accounts/:id/comparison/locations` with validation and strict scoping.
  3. Return structured states for insufficient/zero-baseline (not 500). Typed DTOs.
  4. **Verify (BDD):** Unit tests for calculation/boundaries/scoping; integration tests (API+DB) for endpoints and edge cases. All scenarios pass; deterministic (fixed dates/timezones).

### Phase 3 - Frontend implementation
- **Goal:** Real API integration, dashboard views.
- **Tasks:**
  1. Create typed API client matching backend DTOs (share types if feasible).
  2. Build account list and account detail views with overall + multi-location comparison panels.
  3. Implement all required states (loading/error/empty/insufficient/zero-baseline). Use shadcn/ui components.
  4. Real API integration (no mocks). Handle failures.
  5. **Verify:** Manual pass against live backend for: a multi-location account, a single-site account, and the zero-events account (identify/create such case if needed based on data). TypeScript build clean. Accessibility/basic UX checks.

### Phase 4 - Testing & hardening
- **Goal:** Comprehensive BDD coverage of business rules; harden.
- **Tasks:**
  1. Ensure acceptance criteria exist for all business rules (create if missing based on scope).
  2. Write unit tests for implemented calculations and edge cases (insufficient history, zero baseline, boundaries, scoping). 
  3. Write integration tests (Supertest) for API, one spec file per rule group in BDD/Gherkin style; map each scenario to acceptance criterion.
  4. Add E2E tests where they validate end-user flow ("Monday morning glanceable", overall+multi-location).
  5. **Verify:** All tests pass (unit/integration/E2E as configured). Deterministic. No unverified claims.

### Phase 5 - Delivery
- **Goal:** Documentation and fresh-clone verification.
- **Tasks:**
  1. Update `README.md` with: product summary, stack, local setup (DB choice PostgreSQL default), loading migrations and seed, run commands (dev/build/test/migrate/seed for root/workspaces), API endpoints summary, assumptions, trade-offs, deferred work, how to run tests.
  2. Document timezone handling, UTC storage, baseline window, "normal" definition, comparison metric.
  3. **Verify (fresh-clone style):** Following README setup steps from scratch (clean env) results in working app: `docker compose up --build` brings up all services, migrations+seed run, backend serves endpoints, frontend renders; all tests pass. Record any final assumptions/trade-offs.

## Non-functional constraints
- Preserve original PLAN.md; record deviations in `PLAN.md` under `Revisions and plan deviations` with rationale/impact/context.
- Evidence-based: follow repo conventions; no mocks unless justified; no alerts/ML.
- Security: parameterized queries, account scoping enforced at service/DB layer.
- Determinism and testability throughout.

## Revisions and plan deviations
- None yet. All items above are planned; any significant deviation must be recorded here with rationale, impact, and approval context.
