import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AccountsPage } from '@/pages/AccountsPage';
import { AccountDetailPage } from '@/pages/AccountDetailPage';

/**
 * Live smoke test (Phase 3 verification, AC-5.7).
 *
 * Unlike the unit tests elsewhere, this renders the real components against a
 * **running backend** — no mocked fetch — so it proves the whole path works:
 * typed client, real payload shapes, and each of the required UI states.
 *
 * Opt-in, because it needs the stack up:
 *   docker compose up -d --build
 *   RELAY_LIVE_API=1 VITE_API_BASE_URL=http://localhost:3000 \
 *     npm test --workspace frontend -- live
 *
 * Accounts exercised (PLAN.md R2):
 *   6  Metro Collision Centers — 15 locations
 *   8  Lakeside Physio         — single location
 *   20 Quiet Harbor Spa        — no activity at all
 */

const live = process.env.RELAY_LIVE_API === '1';

describe.skipIf(!live)('live dashboard against a running backend', () => {
  beforeAll(() => {
    if (!globalThis.fetch) throw new Error('fetch is unavailable in this environment');
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  /** Renders the detail page at `/accounts/:id`, optionally with a query. */
  function renderAccount(target: number | string) {
    const path = typeof target === 'number' ? `/accounts/${target}` : target;
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/accounts/:id" element={<AccountDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('Given the accounts list, When rendered, Then every customer is linked (AC-5.1)', async () => {
    render(
      <MemoryRouter>
        <AccountsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: 'Metro Collision Centers' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Quiet Harbor Spa' })).toBeVisible();
    expect(screen.getAllByRole('link')).toHaveLength(20);
  });

  it('Given a 15-location account, When rendered, Then the comparison and per-site view appear (AC-5.2, AC-5.3)', async () => {
    renderAccount(6);

    expect(
      await screen.findByRole('heading', { name: 'Metro Collision Centers' }),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: /is this week normal for you/i })).toBeVisible();
    expect(screen.getByText(/Week of 20 Jul . 26 Jul 2026/)).toBeVisible();
    expect(screen.getAllByText('America/New_York').length).toBeGreaterThan(0);

    // Per-location table for all 15 sites, sorted worst-first.
    expect(await screen.findByRole('heading', { name: /by location/i })).toBeVisible();
    const table = screen.getByRole('table');
    expect(screen.getByRole('columnheader', { name: /location/i })).toBeVisible();
    expect(table).toHaveTextContent('Site O');
    expect(table).toHaveTextContent('Site A');

    // The reported week for account 6 is below normal for calls and leads.
    expect(screen.getAllByText('Below normal').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Typical').length).toBeGreaterThan(0);
  });

  it('Given a single-location account, When rendered, Then no per-site table is shown (AC-5.3)', async () => {
    renderAccount(8);

    expect(await screen.findByRole('heading', { name: 'Lakeside Physio' })).toBeVisible();
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /by location/i })).toBeNull();
    });
  });

  it('Given a location is chosen, When rendered, Then the whole page narrows to that site (AC-5.8, AC-3.9)', async () => {
    const user = userEvent.setup();
    renderAccount(6);

    const picker = await screen.findByRole('combobox', { name: /location/i });
    const options = Array.from((picker as HTMLSelectElement).options).map((o) => o.value);
    expect(options[0]).toBe('');
    expect(options).toHaveLength(16); // "All locations" + 15 sites

    await user.selectOptions(picker, 'Site A');

    // The heading, the table and the totals all move to the chosen site.
    expect(
      await screen.findByRole('heading', { name: /is this week normal for Site A\?/i }),
    ).toBeVisible();
    expect(await screen.findByRole('heading', { name: /by location: Site A/i })).toBeVisible();

    const table = screen.getByRole('table');
    expect(table).toHaveTextContent('Site A');
    expect(table).not.toHaveTextContent('Site B');
  });

  it('Given the filter is cleared, When rendered, Then every location comes back (AC-5.8)', async () => {
    renderAccount(`/accounts/6?location=${encodeURIComponent('Site A')}`);

    const picker = await screen.findByRole('combobox', { name: /location/i });
    expect((picker as HTMLSelectElement).value).toBe('Site A');
    await screen.findByRole('heading', { name: /is this week normal for Site A\?/i });

    fireEvent.change(picker, { target: { value: '' } });

    expect(
      await screen.findByRole('heading', { name: /is this week normal for you\?/i }),
    ).toBeVisible();
    const table = await screen.findByRole('table');
    expect(table).toHaveTextContent('Site O');
  });

  it('Given a location that does not belong to the account, When requested, Then the API rejects it (AC-4.7)', async () => {
    renderAccount(`/accounts/8?location=${encodeURIComponent('Site O')}`);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Site O/);
  });

  it('Given the zero-activity account, When rendered, Then an empty state is shown, not an error (AC-5.4, AC-5.7)', async () => {
    renderAccount(20);

    expect(await screen.findByRole('heading', { name: 'Quiet Harbor Spa' })).toBeVisible();
    expect(await screen.findByText(/No activity recorded/i)).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Given an unknown account, When rendered, Then an error is shown (AC-5.4)', async () => {
    renderAccount(9999);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/not found/i);
  });

  it('Given a request still in flight, When rendered, Then a loading state is shown (AC-5.4)', async () => {
    const original = globalThis.fetch;
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      await gate;
      return original(input, init);
    }) as typeof fetch;

    renderAccount(6);

    // Loading is announced politely for assistive technology.
    expect(await screen.findByRole('status')).toHaveTextContent(/loading/i);

    release?.();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Metro Collision Centers' })).toBeVisible();
    });

    globalThis.fetch = original;
  });

  it('Given the backend is unreachable, When rendered, Then a retryable error is shown (AC-5.5)', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;

    renderAccount(6);

    expect(await screen.findByText(/cannot reach the analytics api/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /try again/i })).toBeVisible();

    globalThis.fetch = original;
  });
});