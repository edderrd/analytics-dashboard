# AGENTS.md — Analytics Dashboard

This file defines project-wide instructions for AI coding agents working on the Relay analytics dashboard.

## Project Context (Confirmed Facts)

- **Product**: B2B SaaS helping service businesses track inbound activity (calls, leads, appointments) across locations. Multi-location customers (1–15+ locations) are important.
- **Goal**: Help customers answer *"is this normal for us?"* at a glance for recent activity without exporting data or calling account managers. The ticket (DASH-247) implies comparing recent activity against a baseline.
- **Data**: Two tables — `accounts` (id, name, industry, timezone IANA, created_at UTC) and `activity_events` (id, account_id, location, event_type in {call_received, lead_created, appointment_set}, occurred_at UTC, duration_seconds nullable for calls, outcome nullable). See `schema.sql` and `seed.sql` (~12.6k events, 20 accounts).
- **Out of scope**: Alerting/notifications, ML/forecasting (explicitly excluded by product).
- **Tech intent**: Backend NestJS + TypeScript; Frontend React + TypeScript; Tailwind CSS + shadcn/ui; Database access via TypeORM; Relational DB (evaluate PostgreSQL as default if not specified). 
- **Data integrity**: All timestamps UTC; account timezones are IANA; preserve the supplied dataset as-is (do not regenerate/extend/replace). Translate schema into TypeORM migrations and seed data into TypeScript seed process (not hand-run DDL in app code). Treat data as real-world/messy.
- **Team**: Spec-driven and AI-first; focus on planning/spec interpretation and reviewing/hardening agent output.

## Development Principles

### 1) Spec-Driven Development
- **Inspect first**: Read ticket, product background, schema, seed (shape, distributions), existing docs, and any existing conventions before planning. Do not assume baseline window/thresholds until reviewed.
- **Create PLAN.md before implementation**: Write a detailed, testable plan with acceptance criteria tied to observable behavior. 
- **Incremental implementation**: Break work into small, verifiable steps. Implement → verify → commit progress. Keep changes focused.
- **Testable acceptance criteria**: Each feature must have clear, measurable acceptance criteria (examples: correct comparison math, proper scoping by account/location, timezone handling). Criteria should be concrete enough to validate without guessing.

### 2) Planning Integrity
- **Preserve original PLAN.md**: Once implementation begins, do not overwrite the original PLAN.md. 
- **Document deviations**: Any significant deviation from the approved plan (scope change, approach change, constraint discovered) must be recorded in `PLAN.md` under a `Revisions & plan deviations` section with rationale, impact, and approval context. Keep the plan coherent.
- **Distinguish facts vs assumptions**: Explicitly mark assumptions in plans/docs. Do not treat assumptions as confirmed requirements.

### 3) Product Scope Boundaries
- **Problem statement**: Focus on helping customers understand if recent activity is "normal for us" via comparison against historical baseline. Must work for multi-location customers.
- **Explicit exclusions**: Alerts/notifications, predictive ML/forecasting. Do not add these unless the ticket explicitly requires them.
- **Avoid unnecessary infrastructure**: Only add infra (queues, jobs, caches beyond what's needed) if strictly required by the ticket. Favor simplest approach that satisfies acceptance criteria.
- **Evidence-based**: Follow repo evidence and existing conventions. Don't invent features.

### 4) Database Practices (TypeORM + Migrations + Seed)
- **Entities**: Create TypeORM entities that match schema accurately (types, nullability, relations: Account 1:N ActivityEvent). Use proper decorators; preserve field names/semantics.
- **Migrations**: Translate `schema.sql` DDL into TypeORM migrations (not manual schema sync in prod). Migrations must be idempotent in structure and reflect the source schema exactly.
- **Seed as TypeScript**: Translate `seed.sql` into a TypeScript seed process using TypeORM (or migration+seed scripts consistent with tooling). Do not regenerate, reorder arbitrarily, or fabricate data. Preserve the original dataset values/counts.
- **Data preservation**: Treat seeded records as immutable reference data for this exercise. Verify record counts match source intent (e.g., ~12.6k events across 20 accounts). If counts differ, investigate before proceeding.
- **Verification**: Include verification steps (counts, sample checks) to confirm seeded data loaded correctly.
- **Time/Timezones**: All `occurred_at` UTC; accounts have IANA timezones. Never assume server local time. Handle conversions carefully when computing "recent" vs baseline in account-local terms if needed.

### 5) Backend Practices (NestJS)
- **Structure**: Follow NestJS conventions (modules, controllers, services, DTOs). Keep separation of concerns; avoid fat controllers.
- **Validation**: Use class-validator/class-transformer for inputs. Validate params (accountId, location, date ranges).
- **Security/queries**: Always use parameterized queries (TypeORM query builders/repositories) — never string-concatenate SQL. Prevent injection.
- **Scoping**: Enforce strict account scoping (data must never leak across accounts). Multi-location must be first-class (filter/group by location as requested).
- **Aggregation**: Use database-backed aggregation where possible for correctness/perf; compute comparisons in app only if DB can't express cleanly — justify choice.
- **API design**: Design read-only endpoints for dashboard consumption (list accounts, locations, activity summaries/comparisons). Keep payloads minimal and typed.
- **Error handling**: Return appropriate HTTP codes; avoid leaking internals.

### 6) Frontend Practices (React + TypeScript + Tailwind + shadcn/ui)
- **Stack**: React with TypeScript. Use Tailwind CSS and shadcn/ui components. Prefer composition over custom heavy CSS.
- **Real API integration**: No mocks unless explicitly justified and documented. Call backend APIs; handle network failures.
- **States**: Every data-fetching view must have loading, error, and empty states with clear user feedback.
- **UX clarity**: The core goal is "is this normal for us?" at a glance — prioritize clarity (status/indicator, comparison values, period context). Multi-location view should help identify which location needs attention.
- **Accessibility/semantics**: Use semantic HTML where sensible; shadcn/ui provides accessible primitives.
- **Type safety**: Share types between frontend/backend where feasible (DTOs/interfaces). Avoid `any`.

### 7) Data Correctness (Critical)
- **Historical comparisons**: Define baseline vs comparison period precisely. Do not guess window/thresholds — derive from ticket + data inspection. Document the chosen approach (inclusive/exclusive boundaries, rolling window vs fixed, etc.) in PLAN.md.
- **Account time zones**: Interpret "recent" in account-local time or consistently across boundaries? Document decision. Convert boundaries using account IANA timezone; compare apples-to-apples with UTC storage.
- **Reporting-period boundaries**: Be explicit about boundaries (e.g., week starts Monday? "Monday morning" mentioned). Handle edge cases around boundaries. 
- **Insufficient history**: Define behavior when baseline has < N events or < required history (cannot compute meaningful comparison). Show explicit state (e.g., "Not enough history" with guidance) — don't fabricate numbers.
- **Zero baselines**: Handle division by zero / zero-baseline cases safely (avoid NaN/Infinity). Define fallback display.
- **Location-level aggregation**: Aggregate at account and location levels. Multi-location customers must see per-location breakdown to spot which location needs attention.
- **Data messiness**: Account for nulls (duration_seconds, outcome), event types, possible gaps. Validate assumptions against seed data.

### 8) Testing
- **Existing tooling**: Follow whatever test setup exists (look for jest/vitest, playwright/cypress, supertest, etc.). If none exists, propose minimal setup consistent with stack in PLAN.md.
- **BDD focus on meaningful business rules**: Write behavior-driven tests (BDD) that express meaningful business rules (e.g., Given/When/Then style). Focus on the core rules: "is this normal for us?" comparison logic, account/timezone boundaries, insufficient history, zero baseline, location-level aggregation (including multi-location), and strict account scoping. Avoid testing trivial implementation details.
- **Coverage**: Include unit tests for business logic (comparisons, scoping, timezone/boundary logic), integration tests (API + DB) for the comparison endpoints, and E2E where it validates an end-user flow. 
- **Verification discipline**: Do not claim tests pass unless actually run. Run tests and report results. If tests fail, fix or explain.
- **Determinism**: Tests should be deterministic (seeded test data, fixed dates/timezones). Avoid depending on "now" without control.

### 9) AI-Agent Workflow
- **Focused prompts**: Give subagents specific, bounded tasks with clear success criteria and relevant context. Include file paths, constraints, expected outputs.
- **Review generated changes**: Treat agent output as draft — review diffs carefully for correctness, scope creep, style consistency, and security issues (SQL injection, scoping leaks).
- **Independent verification**: Verify results yourself (run build/lint/tests, spot-check data). Cross-check against requirements. Don't blindly accept.
- **Evidence over assertion**: Back claims with evidence (file reads, command output, test results).
- **Minimal, targeted edits**: Use edit/write tools appropriately. Avoid large unrelated changes.

### 10) Delivery
- **README requirements**: Update README with project purpose, stack, local setup (DB setup, migrations, seed), run commands (dev, build, test, migrate, seed), API endpoints summary (if any), assumptions, trade-offs, deferred work.
- **Local setup**: Document DB choice (default PostgreSQL if unspecified). Include loading schema/migrations and running seed. Note UTC/timezone handling.
- **Commands**: Provide clear npm/yarn/pnpm commands matching package.json scripts.
- **Transparency**: List assumptions explicitly (especially baseline window, "normal" definition, comparison metric). List trade-offs made. List deferred work not needed now.
- **No implementation yet**: This file is guidance only. Do not generate PLAN.md or application code until instructed. After creating AGENTS.md, summarize main rules, explain assumptions, and list recommended next steps.