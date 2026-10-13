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
- Backend tests: Jest + Supertests (NestJS e2e)
- Frontend tests Seed: Vitest + React Testing Library, Typescript seed process (backend/src/database/seed/)
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
- Reporting period = complete week ending before/at last complete week boundary relative to last event? Fixture: last event 2026-07-27 (Monday). Exclude partial → reporting 2026-07-20 (Sun?) through 2026-07-26 (Sat?) complete week. Define inclusive/exclusive explicitly (e.g., [reportStartLocal, reportEndLocal+1) in UTC or inclusive dates).
- Baseline = previous N weeks (BASELINE_WEEKS=8) immediately before reporting period, same weekday alignment (rolling window of complete weeks), excluding the reporting week and any partial week.
- Week start: assume ISO week? Or Monday start (matches "Monday morning"). Document assumption (fixture context) and enforce consistently.

**Comparison metrics (per account/location):**

- For each (account, location?, event_type) compute `count_recent = events in reporting week`.
- Baseline: for same (account, location?, event_type) over baseline weeks, compute per same-weekday-of-week counts across baseline weeks → baseline mean `mean_baseline = mean of counts for matching weekday slots` (or overall weekly totals normalized by weekday pattern) and sample count `n_baseline_weeks_with_data_or_total_slots`.
- Define "normal": `mean_baseline == 0` → zero baseline case (see 3a). Else let `diff_pct = |count_recent - mean_baseline| / mean_baseline * 100`. `diff_pct <= NORMAL_BAND_PCT` → typical; `count_recent > mean_baseline and diff_pct > NORMAL_BAND_PCT` → above; `count_recent < mean_baseline and diff_pct > NORMAL_BAND_PCT` → below.

**3a) Edge cases:**

- **Insufficient history**: If baseline weeks available < MIN_BASELINE_WEEKS OR baseline observation slots < required? Define as: baseline coverage insufficient to compute meaningful comparison (e.g., account age/history < 4 weeks) OR when we cannot form baseline mean with confidence. Also if `n_baseline_weeks_with_data_or_slots < MIN_BASELINE_OBS` in a relevant sense. Show explicit state "Not enough history" with guidance; never fabricate numbers.
- **Zero baselines**: If `mean_baseline == 0` and `count_recent == 0` → typical (or explicit "no activity, no change")? If `mean_baseline == 0` and `count_recent > 0` → above (infinite relative increase) — cannot use percentage; define fallback display (e.g., "Above (was 0, now N)") and avoid NaN/Infinity. Document fallback.
- **No data in reporting period**: `count_recent == 0` vs baseline>0 → below or typical depending on band? (0 vs mean>0: diff_pct = 100% if mean>0; band 30% means 0 is below unless mean tiny but >=3 obs rule). Handle explicitly.
- **Nulls/messiness**: `duration_seconds` nullable (ignore for counts), `outcome` nullable, event types constrained, gaps possible. Scoping by account/location mandatory.
- **Multi-location**: Aggregation at account-level (overall) and per-location. Must identify which location needs attention (per-location comparison).

### 4) Backend API (NestJS + TypeORM)

**Read-only endpoints (dashboard):**

- `GET /accounts` — list accounts (id, name, industry, timezone). Sorted by name/id.
- `GET /accounts/:id` — account details + timezone + created_at.
- `GET /accounts/:id/locations` — distinct locations for account (sorted). Used for multi-location view.
- `GET /accounts/:id/comparison` — overall comparison for account (all locations). Query: `?asOf=YYYY-MM-DD` (optional, default to fixture/reporting week end) and `?eventTypes=call_received,lead_created,appointment_set` (optional). Returns per event_type: recent count, baseline mean, diff pct or fallback, status (above/typical/below/insufficient/zero-baseline), period context (reporting week range in account-local and UTC), baseline window.
- `GET /accounts/:id/comparison/locations` — per-location comparison. Query params same + `?locations=...` (optional filter). Returns array of locations with same comparison fields.

**Design notes:**

- Modules: `AccountsModule`, `ActivityModule` (or combined), `ComparisonsModule` (service encapsulating business logic). Controllers thin; services fat with logic.
- Validation: class-validator on params/query (UUID/int, date format YYYY-MM-DD, enum values).
- DB access: TypeORM repositories + query builders; use parameterized queries only. Prefer DB aggregation for counts (GROUP BY account_id, location, event_type, date_trunc by week/weekday) to be correct and efficient for ~12.6k rows.
- Scoping: every query filters by `account_id` = path param; location filters only within same account. No cross-account leakage.
- Errors: 400 for bad params, 404 if account not found, 422/appropriate if insufficient data (return structured insufficient state, not 500). Keep responses typed (DTOs).

### 5) Frontend (React + TypeScript + Tailwind + shadcn/ui)

**Pages/views:**

- Account list (home) — cards/table of accounts with link to detail.
- Account detail — header (name, industry, timezone). Overall comparison panel ("Is this normal for us?") showing: reporting period label (e.g., "Week of 2026-07-20 – 2026-07-26 (account-local)"), per event type cards with count_recent, baseline mean, status badge (Typical/Above/Below/Not enough history/Zero baseline), and percent difference when applicable.
- Multi-location section — tabs or table: per location with same metrics; highlight locations needing attention (Above/Below). Sort by status severity then location name.

**UX states (required):**

- Loading: skeletons/spinners while fetching.
- Error: clear message + retry.
- Empty: when no events in range (show zero-baseline/empty states).
- Insufficient history: explicit guidance ("Not enough history — need at least N baseline weeks/observations").
- Zero baseline: explicit display (e.g., "Was 0, now 3" for Above).

**Implementation:**

- Vite + React + TS, Tailwind CSS + shadcn/ui components (cards, badges, tables, tabs, skeletons, alert).
- API client with typed interfaces shared with backend DTOs where feasible.
- Real API integration (no mocks). Handle network failures.
- Accessibility: semantic HTML; shadcn/ui primitives accessible. Avoid `any`.

### 6) Testing (BDD focus on meaningful business rules)

Follow existing tooling if present (jest/vitest, supertest, RTL, playwright/cypress). If none, propose in PLAN.md. Focus BDD (Given/When/Then) on business rules:

**Unit tests (business logic):**

- Given account with 8 weeks baseline, When comparing same weekday week, Then band ±30% computed correctly.
- Given mean_baseline==0 and recent>0, When comparing, Then status Above with fallback (no NaN/Infinity).
- Given mean_baseline==0 and recent==0, When comparing, Then defined state (typical/no activity).
- Given baseline weeks < MIN_BASELINE_WEEKS, When comparing, Then status "insufficient history".
- Given baseline observations < MIN_BASELINE_OBS, When comparing, Then status "insufficient history" (per rule).
- Given boundary crossing (week start Monday), When converting UTC→account-local, Then boundaries correct.
- Given multi-location, When aggregating, Then per-location scoped to account only.

**Integration tests (API + DB):**

- GET /accounts/:id/comparison returns correct overall metrics for seeded fixture account (deterministic with fixed dates).
- GET /accounts/:id/comparison/locations returns per-location with strict account scoping.
- Params validation (invalid date/eventTypes) → 400; unknown account → 404.
- Insufficient/zero-baseline cases return structured states (not errors).

**E2E (where appropriate):**

- Account detail loads and shows overall + multi-location sections with states; "Monday morning glanceable" flow.

**Verification discipline:**

- Deterministic (fixed asOf/reporting dates, seeded test data, controlled timezones).
- Do not claim pass unless actually run; report results.

### 7) Implementation steps (incremental)

1. **Inspect data** (must): read seed ranges per account, locations per account, event distributions to confirm baseline/window assumptions (record findings in PLAN.md).
2. **Scaffold**: npm workspaces (backend NestJS, frontend Vite+React+TS), docker-compose (postgres), TypeORM config, shared types package optional.
3. **DB**: entities + migrations from schema.sql; TS seed from seed.sql + verification.
4. **Core logic**: comparison service (timezone/boundary math, baseline mean, banding, edge cases). Unit tests first (TDD/BDD).
5. **API**: read-only endpoints with validation, strict scoping, DTOs. Integration tests.
6. **Frontend**: pages/components with all states, real API integration. RTL tests for states.
7. **Verification**: run migrations+seed against test DB, run all tests, spot-check against fixture numbers, update README with setup/commands/assumptions/trade-offs/deferred work.

### 8) Non-functional constraints

- Preserve original PLAN.md; record deviations in `PLAN.md` under `Revisions and plan deviations` with rationale/impact/context.
- Evidence-based: follow repo conventions; no mocks unless justified; no alerts/ML.
- Security: parameterized queries, account scoping enforced at service/DB layer.
- Determinism and testability throughout.

## Revisions and plan deviations

- None yet. All items above are planned; any significant deviation must be recorded here with rationale, impact, and approval context.
