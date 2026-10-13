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
| 3) Baseline vs comparison periods (correctness) | Phase 2 (+3) | AC-3.1 – AC-3.9 | Unit tests (BDD) + integration tests (Supertest) |
| 4) Backend API (NestJS + TypeORM) | Phase 2 (+3) | AC-4.1 – AC-4.7 | Integration tests (Supertest, API + DB) |
| 5) Frontend (React + TS + Tailwind + shadcn/ui) | Phase 3 | AC-5.1 – AC-5.8 | TS build + manual pass against live backend |
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
- [x] **AC-3.1** Boundaries computed in account-local time using IANA timezone; converted to UTC; week start (Monday) documented and applied consistently; inclusive/exclusive explicit. *(Verified: `common/dates/local-date.ts` + `account-time.ts` with BDD tests covering Monday-start weeks, month/year rollover, leap day, and DST in both directions — a week spanning the US DST switch is 167 hours, and a Los Angeles Monday resolves to `07:00Z` while New York resolves to `04:00Z`. Day bucketing happens in Postgres via `(occurred_at AT TIME ZONE $tz)::date`. Response exposes both local and UTC bounds; the end bound is exclusive.)*
- [x] **AC-3.2** Reporting period is complete week before last event (fixture 2026-07-20 → 2026-07-26); baseline is previous 8 complete weeks (2026-05-25 → 2026-07-19). *(Verified: `asOf=2026-07-27` yields reporting 2026-07-20 → 2026-07-26 and baseline 2026-05-25 → 2026-07-19. The incomplete week containing `asOf` is excluded. Default `asOf` comes from the dataset's latest event, never the wall clock, so results are reproducible.)*
- [x] **AC-3.3** Comparison by event_type (call_received, lead_created, appointment_set); account-level and per-location; strict account scoping. *(Verified: integration tests assert exact counts for account 6 (51/17/19) and account 12 (30/18/6), and per-location counts sum to the account total.)*
- [x] **AC-3.4** Normal band ±30% (NORMAL_BAND_PCT); correct status mapping (typical/above/below) when baseline>0. *(Verified: unit tests pin the boundaries — exactly ±30% is typical, 31%+ is above/below; account 6 reports −50.1% as below and −26.6% as typical.)*
- [x] **AC-3.5** Insufficient history: status "Not enough history" (no fabricated numbers) when baseline weeks < MIN_BASELINE_WEEKS or baseline observation slots < MIN_BASELINE_OBS; returned as structured state. *(Verified: two distinct reasons — `not_enough_history` (fewer than 4 complete weeks) and `not_enough_observations` (fewer than 3 active baseline weeks). Reachable with `asOf=2026-02-23` per R3, and for the zero-activity account 20, which returns 200 with structured states rather than an error.)*
- [x] **AC-3.6** Zero baseline: mean==0 and recent==0 → defined state (typical/no activity); mean==0 and recent>0 → Above with fallback display, no NaN/Infinity. *(Verified via `classifyAgainstBaseline` unit tests, plus a property check that no code path yields NaN or Infinity. See R11 — the exactly-zero-mean branch is defensive, not routinely reachable, because MIN_BASELINE_OBS already rejects an all-zero baseline. The realistic small-baseline case (mean < 1) is covered and reports a finite percentage.)*
- [x] **AC-3.7** Nulls handled (duration_seconds/outcome ignored for counts), gaps allowed, event types constrained; parameterized queries only. *(Verified: comparisons count events only; `duration_seconds` and `outcome` are never aggregated (R5). All queries use TypeORM parameter binding or repository APIs — no string interpolation of user input.)*
- [x] **AC-3.8** Multi-location: per-location scoped to account; account-level includes all locations. *(Verified: account 6 returns 15 locations; an integration test asserts per-location recent counts sum exactly to the account-level count, and that a location belonging to another account is rejected.)*
- [x] **AC-3.9** Filtering by location narrows the aggregation rather than changing its basis: the baseline for a filtered view is that location's own history, not a share of the account total. *(Added in this pass — see R14. Verified: `?locations=Site A` on account 6 yields 7 calls where the unfiltered account total is 51 across 15 sites, and filtering to two locations equals the sum of exactly those two per-location rows.)*

### AC-4: Read-only API (Phase 2)
- [x] **AC-4.1** `GET /accounts` returns sorted list (id,name,industry,timezone). *(Verified: 20 accounts sorted by name, each with a `locationCount`.)*
- [x] **AC-4.2** `GET /accounts/:id` returns details (id,name,industry,timezone,created_at); 404 if not found. *(Verified; unknown id → 404, non-numeric id → 400.)*
- [x] **AC-4.3** `GET /accounts/:id/locations` returns distinct locations sorted. *(Verified: 15 for account 6, 1 for account 8, `[]` for account 20.)*
- [x] **AC-4.4** `GET /accounts/:id/comparison` returns per event_type with recent count, baseline mean, diff pct or fallback, status, period context (account-local and UTC), baseline window; accepts `asOf` (optional, YYYY-MM-DD) and `eventTypes` filter (optional); 400 on bad params. *(Verified for all fields; `eventTypes` accepts a comma list; malformed/unknown values and unknown query keys → 400.)*
- [x] **AC-4.5** `GET /accounts/:id/comparison/locations` returns per-location comparisons with same fields; supports `locations` filter; strict account scoping. *(Verified: filtering returns exactly the requested locations; an unknown location → 400 rather than being silently ignored.)*
- [x] **AC-4.6** Insufficient/zero-baseline returned as structured states (not 5xx); 404 for unknown account; controllers thin, services encapsulate logic; typed DTOs. *(Verified: zero-activity account returns 200 with `hasActivity: false`; all edge cases are 200/400/404, never 5xx. Controllers only parse/validate and delegate; `ComparisonsService` owns period resolution, aggregation and classification; responses are typed DTOs.)*
- [x] **AC-4.7** Location filtering applies to **both** comparison endpoints; the response states its scope; unknown locations are rejected. *(Added in the Phase 3 pass — see R14. Verified by `backend/test/location-filter.e2e-spec.ts`: `?locations=Site A` on `/comparison` returns `filteredLocations: ["Site A"]` and totals equal to that site's per-location row; several locations sum exactly to their per-location rows; the full `locations` list is still returned so a picker can be built; an unknown location → 400 on both endpoints, including when mixed with a valid one; account 12 cannot reach account 6's sites.)*

### AC-5: Frontend UI/UX (Phase 3)
- [x] **AC-5.1** Account list links to detail. *(Verified live: 20 accounts rendered, each name linking to `/accounts/:id`.)*
- [x] **AC-5.2** Account detail shows header and overall comparison panel ("Is this normal for us?") with reporting period label and per event type cards (recent, baseline mean, status badge, percent when applicable). *(Verified live for account 6: heading, the "Week of 20 Jul – 26 Jul 2026" caption, the account's zone, one card per event type with the count, usual-week mean, status badge and signed percentage.)*
- [x] **AC-5.3** Multi-location section shows per-location metrics; highlights Above/Below; sorted by status severity then location name. *(Verified live: all 15 sites of account 6 appear in a captioned table, rows grouped per site with a "Needs a look" marker when a site moved, and the furthest-from-usual site listed first. A single-location account correctly shows no table.)*
- [x] **AC-5.4** Required states: loading, error, empty, insufficient history, zero baseline. *(All five verified live: a polite `role="status"` loading state; a retryable `role="alert"` error state; an empty-list state; a "Not enough history yet" state when nothing can be compared; and a "No activity recorded" state for account 20.)*
- [x] **AC-5.5** Real API integration (no mocks); network failures handled; typed API client; TS build clean. *(Verified: the app calls a same-origin `/api` proxied to the backend; there is no mock anywhere in `src/`. An unreachable backend produces the offline message plus a working "Try again" button. `tsc -b && vite build` is clean.)*
- [x] **AC-5.6** Tailwind + shadcn/ui; accessible primitives/semantic HTML; no `any`. *(Verified: Tailwind v4 via `@tailwindcss/vite` with shadcn tokens, and shadcn Button/Card/Badge/Table/Skeleton primitives plus `components.json`. No `any` anywhere in `src/`. Semantics: one `h1` per page, `caption` and `scope="col"` headers on the table, `aria-live="polite"` on loading, `role="alert"` on errors, `aria-hidden` on decorative icons, and a screen-reader-only explanation beside each status badge.)*
- [x] **AC-5.7** Manual verification passes against live backend for: multi-location account, single-site account, zero-events account. *(Verified against the running compose stack with an opt-in live smoke suite (`frontend/src/test/live-dashboard.spec.tsx`, 10 scenarios, real network): account 6 (15 locations), account 8 (single site, no table shown), account 20 (empty state, not an error).)*
- [x] **AC-5.8** A location picker narrows the whole page to one site or shows all of them. *(Added in this pass — see R14. The picker offers "All locations" plus every site, is shown only for multi-location accounts, and its selection lives in the `?location=` query parameter so the view is shareable and the back button works. Selecting a site narrows the overall cards, the heading and the per-site table together; site names in the table are also buttons that apply the same filter. Verified hermetically in `frontend/src/test/location-filter.spec.tsx` (7 scenarios) and live against the backend, including clearing the filter and a rejected unknown location.)*

### AC-6: Testing (BDD, meaningful business rules) (Phase 4)
- [x] **AC-6.1** Unit tests cover banding ±30%, zero-baseline fallbacks, insufficient history (MIN_BASELINE_WEEKS/MIN_BASELINE_OBS), timezone boundaries/Monday start/UTC conversion, multi-location scoping, strict account scoping. *(Verified: 51 backend unit tests. Banding boundaries are pinned at exactly ±30%; both insufficient-history reasons are covered; DST is covered in both directions, including a 167-hour week spanning the US switch; `classifyAgainstBaseline` is tested directly for the zero-mean cases. A new `spec-coherence.spec.ts` mechanically checks that every AC in the AC-3/4/5 groups is cited by at least one test, so coverage cannot silently rot.)*
- [x] **AC-6.2** Integration tests (Supertest, API+DB) cover all endpoints, validation (400/404), strict scoping, structured states, deterministic with fixed dates/timezones. *(Verified: 62 integration tests across 7 spec files, run against an isolated `relay_test` database that is dropped, migrated and re-seeded on every run, so the reference dataset is never touched by tests. Validation, 400/404 handling, scoping and structured states are all asserted, including synthetic fixtures for the edge cases the supplied data cannot reach.)*
- [x] **AC-6.3** BDD specs in Gherkin-style (Given/When/Then), one spec file per rule group; each scenario maps to an acceptance criterion. *(Verified: five Gherkin feature files under `backend/test/features/` — comparison periods, banding, multi-location, location filtering, seed integrity. Each declares the specs that implement it, and `spec-coherence.spec.ts` fails if a feature has no implementing spec, if a scenario stops matching its specs, or if an `@AC` tag does not exist in this plan.)*
- [x] **AC-6.4** E2E tests validate end-user flow ("Monday morning glanceable", overall + multi-location). *(Verified: `frontend/src/test/e2e-monday-morning.spec.tsx` walks the journey against a live backend — choose the customer, read the headline answer and the "week of" caption, find the sites needing attention, then narrow the page to one site — plus the no-activity customer. 27 frontend scenarios pass live in total.)*
- [x] **AC-6.5** Tests deterministic (seeded test data, fixed asOf/reporting dates, controlled timezones); no dependence on `now`. *(Verified: `test/setup-env.ts` pins `TZ=UTC` and the test database for every integration run; `asOf` is fixed in fixtures; a coherence test asserts no integration spec uses `new Date()` or `Date.now()`. Pinning `TZ` matters more than it looks — see R19.)*
- [x] **AC-6.6** All tests pass; results reported (no unverified claims). *(Verified by `npm run verify`, which runs seed verification, both builds, the backend typecheck, backend unit and integration tests and the frontend suites, then prints a PASS/FAIL summary: every step passes. `npm run verify:live` adds the opt-in live frontend suites.)*

### AC-7: Delivery & docs (Phase 5)
- [x] **AC-7.1** README.md updated with product summary, stack, local setup (PostgreSQL default), loading migrations and seed, timezone/UTC handling, baseline window, "normal" definition, comparison metric. *(Verified: README covers the product question, the stack, quick start via Compose, the non-Docker development path, a "How normal is decided" section with the full status table and the assumptions behind each constant, a data/time-zone section explaining the UTC storage and the two guards, and the deferred-work list.)*
- [x] **AC-7.2** README lists all runnable commands (dev/build/test/migrate/seed for root/workspaces), API endpoints summary, assumptions, trade-offs, deferred work, how to run tests. *(Verified: command tables were generated from the actual `package.json` scripts rather than written from memory, and each was executed. Endpoint table matches the controller; the API example is a real captured response.)*
- [x] **AC-7.3** Docker flow documented: `migrate && seed` run before app start in compose; fresh `docker compose up --build` works. *(Verified: documented and exercised from a clean clone; container logs show migration → seed → start.)*
- [x] **AC-7.4** Fresh-clone style verification complete: following README from a clean env, all services up, migrations+seed applied, backend endpoints serve, frontend renders, all tests pass. *(Performed: cloned the repository into a new directory with no `.env`, no `node_modules` and no database volume, then ran the README steps end to end — `docker compose up --build`, endpoint checks, and `npm test`. All passed. Doing this surfaced a wrong command in the README, now fixed and recorded as R23.)*
- [x] **AC-7.5** Assumptions, trade-offs, deferred work explicitly listed in README. Any deviations recorded under `Revisions and plan deviations`. *(Verified: dedicated README sections. Trade-offs include the quiet-weeks baseline choice (R10), the zero-baseline wording open question (R20), the native select (R15), the single-query aggregation, and the pinned TypeORM lines (R7). Deviations run to R23 in this plan.)*

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
- `GET /accounts/:id/comparison` — overall comparison for account (all locations, or a `locations` subset). Query: `?asOf=YYYY-MM-DD` (optional), `?eventTypes=...` (optional), `?locations=Site A,Site B` (optional, added in the Phase 3 pass — R14). Returns per event_type with recent count, baseline mean, diff pct or fallback, status, period context, baseline window, the full `locations` list and `filteredLocations` (null when unfiltered).
- `GET /accounts/:id/comparison/locations` — per-location comparison. Same query params. Returns per-location comparisons.

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
- Location picker (added in the Phase 3 pass — R14) — "All locations" plus one option per site, shown only for multi-location accounts; narrows the overall cards and the per-site table together; selection lives in `?location=`.

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
- **Status:** ✅ Complete.
- **Delivered:**
  - `common/dates/local-date.ts` (zone-less calendar maths, Monday weeks) and `common/dates/account-time.ts` (IANA ⇄ UTC, DST-safe, week bounds).
  - `modules/comparisons/domain/` — `comparison-periods.ts` (reporting + 8 baseline weeks) and `compare-to-baseline.ts` (banding, insufficient-history, zero-baseline).
  - `modules/comparisons/comparisons.service.ts` — one aggregation query per request bucketed by account-local day, strict account scoping, structured states.
  - `modules/comparisons/comparisons.controller.ts` + DTOs + a global `ValidationPipe`.
  - Tests: 42 unit (BDD) and 33 integration (Supertest, live DB), one file per rule group, each scenario citing its AC.
- **Tasks:**
  1. Implement comparison service (timezone/boundary math, baseline mean by weekday pattern, banding, edge cases). Use TypeORM best practices (repositories/query builders, parameterized). 
  2. Implement endpoints: `/accounts`, `/accounts/:id`, `/accounts/:id/locations`, `/accounts/:id/comparison`, `/accounts/:id/comparison/locations` with validation and strict scoping.
  3. Return structured states for insufficient/zero-baseline (not 500). Typed DTOs.
  4. **Verify (BDD):** Unit tests for calculation/boundaries/scoping; integration tests (API+DB) for endpoints and edge cases. All scenarios pass; deterministic (fixed dates/timezones). *(Verified: 42 unit + 33 integration tests pass; totals cross-checked against independent SQL aggregations.)*

**Notes for Phase 3:**
- The comparison response is the contract the UI renders: `status` ∈ {above, typical, below, insufficient_history} plus `reason`, `changePct` (null for a zero baseline) and the period context needed for the "week of …" caption.
- `hasActivity: false` is the empty-state signal for account 20 (AC-5.7).
- Integration tests need the seeded compose DB (`docker compose up -d db && npm run migrate && npm run seed`); they are read-only against it.

### Phase 3 - Frontend implementation
- **Goal:** Real API integration, dashboard views.
- **Covers:** AC-5 — spec section 5.
- **Status:** ✅ Complete.
- **Added after verification (this pass):** location filter across backend and frontend — `AC-4.7`, `AC-3.9`, `AC-5.8`; see `Revisions and plan deviations` R14–R16.
- **Delivered:**
  - `src/api/` — typed client (`types.ts` mirrors the backend DTOs) and a same-origin `/api` call path with typed `ApiError` extraction.
  - `src/hooks/useAsync.ts` — loading/error/success with abort-on-unmount and `reload` for retry.
  - `src/components/` — `OverallComparison` (per-event-type cards + period caption), `LocationComparisonTable` (severity-sorted, grouped per site), `StatusBadge` (status + screen-reader explanation), `states.tsx` (loading/error/empty).
  - `src/pages/` — `AccountsPage` (list) and `AccountDetailPage` (comparison + per-location).
  - Routing via `react-router-dom`; `/api` proxied by Vite in dev/preview and by nginx in the container (`frontend/nginx.conf`).
  - Tests: 3 routing smoke tests (always run) + 7 opt-in live smoke tests against a running backend.
- **Tasks:**
  1. Create typed API client matching backend DTOs (share types if feasible).
  2. Build account list and account detail views with overall + multi-location comparison panels.
  3. Implement all required states (loading/error/empty/insufficient/zero-baseline). Use shadcn/ui components.
  4. Real API integration (no mocks). Handle failures.
  5. **Verify:** Manual pass against live backend for: a multi-location account, a single-site account, and the zero-events account (identify/create such case if needed based on data). TypeScript build clean. Accessibility/basic UX checks. *(All verified — see AC-5.1 – AC-5.7. The three accounts are 6, 8 and 20; no synthetic account was needed, per R2.)*

**Notes for Phase 4:**
- The live smoke suite is opt-in (`RELAY_LIVE_API=1`) so the default `npm test` stays hermetic and needs no backend; Phase 4 should decide whether it joins CI.
- The API contract the UI depends on is `frontend/src/api/types.ts`, a hand-written mirror of the backend DTOs. Any Phase 4 change to a response shape must change that file too.
- Location filtering is now covered on both sides: 13 backend integration scenarios (`test/location-filter.e2e-spec.ts`), 7 hermetic and 3 live frontend scenarios (`test/location-filter.spec.tsx`, `test/live-dashboard.spec.tsx`). Phase 4 should keep these and fill any remaining case (e.g. a filter combined with a non-default `asOf`).

### Phase 4 - Testing & hardening
- **Goal:** Comprehensive BDD coverage of business rules; harden.
- **Covers:** AC-6 — spec section 6, and provides the verification evidence for AC-3 / AC-4 / AC-5.
- **Status:** ✅ Complete.
- **Delivered:**
  - Isolated test database: `scripts/setup-test-database.mjs` drops/creates/migrates/seeds `relay_test`; `test/setup-env.ts` pins `DATABASE_NAME` and `TZ=UTC`; integration suites run serially.
  - Synthetic fixture suite (`test/edge-cases.e2e-spec.ts`) for the rules the supplied data cannot reach: zero baseline, both insufficient-history reasons and the exact minimum boundary, NULL duration/outcome, and DST week edges.
  - Seed integrity suite (`test/seed-integrity.e2e-spec.ts`) running both Phase 1 verifiers and asserting counts, referential integrity, UTC timestamps and schema parity.
  - Gherkin feature files (`test/features/*.feature`), one per rule group, each declaring the specs that implement it.
  - Coherence suite (`src/testing/spec-coherence.spec.ts`) enforcing feature ↔ spec ↔ PLAN agreement, AC coverage, and test determinism.
  - UI convention suite (`frontend/src/test/ui-conventions.spec.ts`) guarding AC-5.6 (no `any`, shadcn primitives present, every status and reason handled).
  - E2E journey (`frontend/src/test/e2e-monday-morning.spec.tsx`) for the "Monday morning glanceable" flow.
  - `npm run verify` / `npm run verify:live` as a single verification entry point with a PASS/FAIL summary.
  - Environment configuration: `.env.example` at the root and in `backend/`, a validated `src/config/env.ts` with working defaults, and Compose variable substitution — all verified to run with no `.env` present and with overrides applied (see R22).
- **Tasks:**
  1. Ensure acceptance criteria exist for all business rules — coverage check: every rule in spec section 3 and every endpoint in spec section 4 maps to at least one AC. *(Done, and now enforced mechanically rather than by inspection — see AC-6.1.)*
  2. Write unit tests for implemented calculations and edge cases (insufficient history, zero baseline, boundaries, scoping).
  3. Write integration tests (Supertest) for API, one spec file per rule group in BDD/Gherkin style; map each scenario to acceptance criterion.
  4. Add E2E tests where they validate end-user flow ("Monday morning glanceable", overall+multi-location).
  5. **Verify:** All tests pass; deterministic; no unverified claims. *(Verified: `npm run verify` passes every step; 51 unit + 62 integration + 27 live frontend scenarios. Two real defects were found and fixed in this phase — R18 and R19.)*

**Notes for Phase 5:**
- `npm test` at the repo root runs the backend unit tests, the frontend tests and the backend integration (Supertest) suites, in that order; it requires the database to be reachable because the integration suite provisions its own `relay_test` database.
- `npm run verify` is the single command to document in the README, alongside `npm run verify:live` and the compose workflow. It also needs the database, for the same reason.
- Two open items to surface as trade-offs rather than fix silently: the R20 product question about zero-baseline wording, and the R10 decision that quiet weeks count towards the baseline.
- The reference database must stay pristine; any future synthetic scenario belongs in `relay_test`, never in the seeded one.

### Phase 5 - Delivery
- **Goal:** Documentation and fresh-clone verification.
- **Covers:** AC-7 (delivery & docs); final AC-1.1 check for recorded deviations.
- **Status:** ✅ Complete.
- **Delivered:** `README.md` rewritten as the project's own documentation (product summary, quick start, every runnable command, configuration, how "normal" is decided, API reference, data and time zones, testing, trade-offs, deferred work, project layout).
- **Tasks:**
  1. Update `README.md` with: product summary, stack, local setup (DB choice PostgreSQL default), loading migrations and seed, run commands (dev/build/test/migrate/seed for root/workspaces), API endpoints summary, assumptions, trade-offs, deferred work, how to run tests.
  2. Document timezone handling, UTC storage, baseline window, "normal" definition, comparison metric.
  3. **Verify (fresh-clone style):** Following README setup steps from scratch (clean env) results in working app: `docker compose up --build` brings up all services, migrations+seed run, backend serves endpoints, frontend renders; all tests pass. Record any final assumptions/trade-offs. *(Performed: the repository was cloned into a clean directory and the README's steps were executed verbatim; the mismatch this surfaced is recorded as R23.)*

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
- **R10 — The baseline mean includes weeks with zero activity (interpretation chosen, was ambiguous).** Spec §3 described a "mean of counts for matching weekday slots" without settling whether quiet weeks count. *Decision:* the mean is taken across all eight baseline weeks, zeros included, because a week with no events is part of what normal looks like for that account; excluding zeros would bias the baseline upwards and make "above" far too easy to trigger. *Alternative considered:* mean over non-zero weeks only, which would raise every baseline and flag more weeks as typical — rejected as the more flattering and less honest option. *Impact:* all reported `baselineMean` values depend on this choice; it is a single documented rule in `compareToBaseline` and is unit-tested. Surfaced as a trade-off for the README.
- **R11 — The exactly-zero-baseline branch is defensive, not routinely reachable.** Because the mean includes zero weeks, a mean of exactly zero implies every baseline week was empty, which `MIN_BASELINE_OBS` already rejects — so `status: above, reason: zero_baseline_new_activity` cannot be produced through `compareToBaseline`. Rather than delete the rule that AC-3.6 specifies, the banding logic was extracted into `classifyAgainstBaseline` and that function is unit-tested directly for the zero cases. *Impact:* AC-3.6 is satisfied and testable; the realistic sparse case (mean below 1) reports a finite percentage and is covered too. Flagged because the naive reading of AC-3.6 suggests a reachable state that is not.
- **R12 — `asOf` names a date inside the current week, not the reporting week.** The first version of a unit test assumed `asOf=2026-07-22` (a Wednesday) would report the week of 2026-07-20, but under the implemented rule — "the complete week *before* the week containing `asOf`" — 2026-07-22 sits in the 07-20 week and therefore reports 07-13. *Decision:* keep the rule (it is what makes a partial current week self-excluding) and state it explicitly in the response's `periods` context so a consumer is never guessing. *Impact:* fixture `asOf` must be 2026-07-27 (or later in that same week) to yield the 07-20 → 07-26 reporting week; this is asserted in tests.
- **R13 — Two aggregation bugs were caught by cross-checking against independent SQL (Phase 2).** (a) `availableBaselineWeeks` was derived from the queried window, which already starts at the baseline, so it was always 0 and every account reported insufficient history; it now reads the account's true earliest activity. (b) The weekly bucketing looked each local date up against the week *start* dates, so only events landing exactly on a Monday were counted — account 6's baseline read 7 calls/week instead of 102.3. *Impact:* both were invisible to unit tests because they lived in the query/shape layer, not the calculation layer; every aggregate is now pinned by an integration test against independently computed SQL figures.
- **R14 — Added in the Phase 3 pass: a location filter ("All locations" or one site).** This is **new scope**, requested after Phase 3 was already verified; it is not part of the original ticket or the AC-1 baseline. *Decision and rationale:* the ticket asks customers to spot "which location needs attention", and with 15 sites on the largest account the table alone is hard to scan; a single-site view is the natural next step and needs no new backend resource. *Backend:* the `locations` filter already existed on `/comparison/locations`, so the change is to honour it on `/comparison` as well (previously the account-level totals ignored it), plus a new `filteredLocations` field stating the response's scope while still returning the full location list for the picker. Unknown locations are rejected with 400 rather than silently ignored, which preserves account scoping (AC-3.3). *Front end:* a picker shown only for multi-location accounts, with the selection held in `?location=` so a filtered view is shareable and the back button works. *Scope boundaries honoured:* read-only, no new dependencies, no alerting, and the baseline for a filtered view remains that location's own history (AC-3.9) — a filter narrows the data, it does not change how "normal" is computed. *Verification:* AC-4.7 (backend, 13 new integration scenarios), AC-5.8 (frontend, 7 hermetic + 3 live scenarios), AC-3.9.
- **R15 — The location picker is a native `<select>`, not the Radix-based shadcn Select.** A deviation from the "shadcn/ui components" instruction, chosen deliberately. *Rationale:* the native control is keyboard- and screen-reader-native with no extra ARIA wiring, needs no `@radix-ui/react-select`, and behaves reliably under jsdom — the Radix Select requires pointer-event stubs that make the interaction tests brittle, which conflicts with the requirement to test this behaviour on both sides. It is styled with Tailwind and sits inside the shadcn Card/Badge vocabulary. *Impact:* visually equivalent to shadcn; if the picker later needs multi-select, checkboxes or an option description, revisit and move to the Radix component.
- **R16 — Refetching keeps the previous data on screen (fixes a picker that vanished mid-interaction).** Found while testing the new filter: because the picker's options come from the API response and the request flips the page back to a loading state, the `<select>` unmounted and remounted on every filter change — it flashed away, lost focus, and dropped the user's next interaction. `useAsync` now retains the last successful result while a new request is in flight and exposes `isRefreshing`; the page also remembers the known locations so the picker stays mounted. *Impact:* first-load skeletons still show, so AC-5.4's loading state is intact; only refetches changed. A related trap found at the same time: `URLSearchParams` encodes a space as `+`, so query strings must be parsed with `URL`/Express semantics rather than a naive regex — the backend handles it correctly, but tests must too.
- **R17 — Corrected a duplicated AC-4 block in this plan.**
- **R18 — Daily bucketing computed the UTC date, not the account-local date (bug found and fixed in Phase 4).** `occurred_at AT TIME ZONE $tz` was assumed to yield the account's local day. For a `timestamp without time zone`, Postgres *interprets* the value as already being in that zone and returns a `timestamptz`; the subsequent `::date` then casts using the **session** zone (UTC). The correct expression is `occurred_at AT TIME ZONE 'UTC' AT TIME ZONE $tz`. *Effect:* events in the first hours of a UTC day were attributed to the previous local day, so for every account west of UTC a handful of late-evening local events could land in the wrong week. *Why it survived Phases 2–3:* the supplied dataset contains no events between 00:00 and ~07:00 UTC, so the mis-bucketed window was empty for every seeded account; it only became visible once Phase 4 added synthetic events near local midnight. *Worse, my "independent SQL cross-check" in Phase 2 repeated the identical mistake*, so it agreed with the buggy code instead of catching it — verification that shares an expression with the code under test is not independent.
- **R19 — Query window bounds were bound as JS `Date`s, which shifted the window on a non-UTC host (bug found and fixed in Phase 4).** `dailyCounts` passed `Date` objects as `$3`/`$4`, and node-postgres formats them in the process time zone. On this host (UTC-6) a window ending `2026-07-27T05:00:00Z` arrived as `2026-07-26 23:00:00`, silently dropping the last six hours of the reporting week. This is the same class of defect as R6, one layer up, and it changed real figures: account 12 moved from 30 to 31 calls and from 18 to 17 leads, and its baseline means from 33.8/13.5/6.8 to 34/13.6/6.8. Fixed by binding `dateToUtcTimestamp(...)` literals (`backend/src/database/pg-timestamp.ts`); account 6 was unaffected. *Impact:* any figure previously reported for a Pacific account was slightly wrong, and only on a non-UTC host — which is precisely why `TZ=UTC` is now pinned for tests (AC-6.5) rather than left to the machine.
- **R20 — AC-3.6 confirmed unreachable through the API, as R11 predicted.** The Phase 4 synthetic fixtures show an event type with no baseline activity is reported as `insufficient_history` / `not_enough_observations`, because `MIN_BASELINE_OBS` rejects a zero-non-zero-week baseline before the zero-baseline branch runs. The API therefore never emits `zero_baseline_new_activity`. *Decision:* the agreed rule was **not** changed unilaterally — `MIN_BASELINE_OBS` was validated against real data in Phase 0 and altering it silently would rewrite that evidence. The integration test now asserts what AC-3.6 actually protects (the count is shown, no percentage is fabricated, no NaN or Infinity), while the zero-mean branch stays covered at unit level. *Open question for product, not for code:* should "this metric never happens here, and it happened this week" read as **new activity** rather than **not enough history**? Answering it means deciding whether a zero baseline should bypass `MIN_BASELINE_OBS`, which is a product call and should be recorded here when made.
- **R21 — Integration tests moved to an isolated, disposable database.** They previously ran against the database seeded from `seed.sql`, which meant any synthetic fixture would have written into reference data (AC-2.3). `npm run test:e2e:setup` now drops, recreates, migrates and re-seeds `relay_test` on every run, `test/setup-env.ts` points the suite at it and pins `TZ=UTC`, and the suites run serially (`maxWorkers: 1`) so synthetic accounts cannot leak into neighbouring specs. *Impact:* the reference database is provably untouched — verified after a full run by re-running `seed:verify-db` against it. An earlier edit had appended a second, unchecked copy of the whole AC-4 group below the verified one, which would have made the plan report false outstanding work. The duplicate was removed and AC-4 consolidated. *Impact:* none on behaviour; noted because the same class of copy-paste error in AC text is how a criterion silently "regresses".
- **R23 — The README's live-test command was wrong, and verifying the README caught it (Phase 5).** The README documented `RELAY_LIVE_API=1 npm test --workspace frontend`, but the live suites also need `VITE_API_BASE_URL`, because the API client calls a same-origin `/api` path that jsdom cannot resolve. Running the documented command produced **11 failures**, while `npm run verify:live` (which sets both) was green — the kind of divergence that a README written from memory always risks. *Fix:* the default now lives in `frontend/vite.config.ts` (`test.env.VITE_API_BASE_URL`), so the documented command works as written and the hermetic suites are unaffected because they stub `fetch`. *Impact:* none on behaviour; it means the README can be trusted because its steps were executed rather than asserted.
- **R22 — Configuration centralised, with `.env` made optional rather than required (Phase 4 hardening).** Configuration was previously spread across inline `process.env.X ?? 'default'` reads in `data-source.ts`, duplicated in `docker-compose.yml`, and nowhere documented. *Decision:* a single `src/config/env.ts` reads and validates everything once, with **every setting having a working default**, and Compose uses `VAR:-default` substitution. *Why defaults rather than required variables:* a fresh clone must run with `docker compose up --build` and no setup step; a missing `.env` is the normal case, not a mistake to diagnose. *Validation:* values are checked at startup (ports must be integers in range, `NODE_ENV` must be one of three values, blank strings rejected) and **all** problems are reported together naming each variable, instead of failing later as an opaque connection error. *`backend/.env`* is loaded when present but never overrides variables already set, so Compose and shell values still win. *Also unified:* the `db` service and the backend now derive their credentials from the same `DATABASE_*` names, so the app cannot be pointed at a different database than Compose created — previously the two lists could drift apart silently. *Verified:* zero-config `npm run verify` and `verify:live` both pass; a root `.env` overriding published ports to 3100/5200 works with the container still listening on 3000; a `backend/.env` renaming `TEST_DATABASE_NAME` moved the integration suite onto a different database with all 62 tests passing and the reference dataset untouched; invalid values fail fast with the variable named.
