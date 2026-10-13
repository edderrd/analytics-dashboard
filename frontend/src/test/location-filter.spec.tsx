import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountDetailPage } from '@/pages/AccountDetailPage';
import type { AccountComparison, LocationComparisonResponse } from '@/api/types';

/**
 * Location picker behaviour, hermetically (AC-5.8, AC-3.9).
 *
 * The backend is stubbed here so the suite stays deterministic and fast; the
 * same behaviour is exercised against a real backend in `live-dashboard.spec.tsx`.
 */

const ALL_LOCATIONS = 'Site A';
const OTHER = 'Site B';

function comparison(overrides: Partial<AccountComparison> = {}): AccountComparison {
  return {
    accountId: 6,
    accountName: 'Metro Collision Centers',
    periods: {
      asOf: '2026-07-27',
      timezone: 'America/New_York',
      reportingWeekStartLocal: '2026-07-20',
      reportingWeekEndLocal: '2026-07-26',
      reportingWeekStartUtc: '2026-07-20T04:00:00.000Z',
      reportingWeekEndExclusiveUtc: '2026-07-27T04:00:00.000Z',
      baselineWindowStartLocal: '2026-05-25',
      baselineWindowEndLocal: '2026-07-19',
      baselineWeeks: 8,
    },
    hasActivity: true,
    locations: [ALL_LOCATIONS, OTHER],
    filteredLocations: null,
    totals: [
      {
        eventType: 'call_received',
        recentCount: 51,
        baselineMean: 102.3,
        changePct: -50.1,
        status: 'below',
        reason: 'outside_normal_band',
        baselineNonZeroWeeks: 8,
        availableBaselineWeeks: 8,
      },
    ],
    ...overrides,
  };
}

function locationsPayload(locationNames: string[]): LocationComparisonResponse {
  return {
    accountId: 6,
    periods: comparison().periods,
    locations: locationNames.map((location) => ({
      location,
      totals: comparison().totals,
    })),
  };
}

function json(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('location filter (AC-5.8)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderAt(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/accounts/:id" element={<AccountDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  /**
   * Routes the two comparison calls by URL.
   *
   * `URL` is used rather than a regex because a query string encodes spaces as
   * "+" (URLSearchParams), which a naive decode would leave as a literal "+".
   */
  function stubApi() {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      const parsed = new URL(url, 'http://api.test');
      const filter = parsed.searchParams.get('locations');

      if (url.includes('/comparison/locations')) {
        return json(locationsPayload(filter ? filter.split(',') : [ALL_LOCATIONS, OTHER]));
      }
      if (url.includes('/comparison')) {
        return json(
          comparison(filter ? { filteredLocations: filter.split(',') } : { filteredLocations: null }),
        );
      }
      return json({ message: 'not found' });
    });
  }

  it('Given a multi-location account, When rendered, Then a picker offers All locations plus every site', async () => {
    stubApi();
    renderAt('/accounts/6');

    const picker = await screen.findByRole('combobox', { name: /location/i });
    expect(picker).toBeInstanceOf(HTMLSelectElement);

    const options = Array.from(
      (picker as HTMLSelectElement).options,
    ).map((option) => option.value);
    expect(options).toEqual(['', ALL_LOCATIONS, OTHER]);
    expect(screen.getByRole('option', { name: 'All locations' })).toBeVisible();
  });

  it('Given no filter, When rendered, Then no filter is sent to the API', async () => {
    stubApi();
    renderAt('/accounts/6');

    await screen.findByRole('combobox', { name: /location/i });
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.every((url) => !url.includes('locations='))).toBe(true);
  });

  it('When a site is chosen, Then the whole page is re-scoped to it', async () => {
    const user = userEvent.setup();
    stubApi();
    renderAt('/accounts/6');

    const picker = await screen.findByRole('combobox', { name: /location/i });
    await user.selectOptions(picker, OTHER);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /is this week normal for Site B/i }),
      ).toBeVisible();
    });

    // Both the totals and the per-location view are filtered.
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    const filteredCalls = urls.filter((url) => url.includes('locations='));
    expect(filteredCalls).toHaveLength(2);
    const decoded = filteredCalls.map(
      (url) => new URL(url, 'http://api.test').searchParams.get('locations'),
    );
    expect(decoded).toEqual([OTHER, OTHER]);
  });

  it('When the filter is applied, Then only that site is listed in the table', async () => {
    const user = userEvent.setup();
    stubApi();
    renderAt('/accounts/6');

    const picker = await screen.findByRole('combobox', { name: /location/i });
    await user.selectOptions(picker, OTHER);

    const table = await screen.findByRole('table');
    expect(table).toHaveTextContent(OTHER);
    expect(table).not.toHaveTextContent(ALL_LOCATIONS);
    expect(
      screen.getByRole('heading', { name: /by location: Site B/i }),
    ).toBeVisible();
  });

  it('When All locations is chosen again, Then the filter is dropped', async () => {
    const user = userEvent.setup();
    stubApi();
    renderAt('/accounts/6');

    const picker = await screen.findByRole('combobox', { name: /location/i });
    await user.selectOptions(picker, OTHER);
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /is this week normal for Site B/i }),
      ).toBeVisible();
    });

    await user.selectOptions(picker, '');
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /is this week normal for you\?/i }),
      ).toBeVisible();
    });
  });

  it('Given a filter in the URL, When the page loads, Then it is applied and reflected in the picker', async () => {
    stubApi();
    renderAt(`/accounts/6?location=${encodeURIComponent(OTHER)}`);

    const picker = (await screen.findByRole('combobox', { name: /location/i })) as HTMLSelectElement;
    expect(picker.value).toBe(OTHER);
    expect(
      await screen.findByRole('heading', { name: /is this week normal for Site B/i }),
    ).toBeVisible();
  });

  it('Given a single-location account, When rendered, Then no picker is shown', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/comparison/locations')) return json(locationsPayload([ALL_LOCATIONS]));
      if (url.includes('/comparison')) {
        return json(comparison({ locations: [ALL_LOCATIONS] }));
      }
      return json({ message: 'not found' });
    });

    renderAt('/accounts/8');

    await screen.findByRole('heading', { level: 1 });
    await waitFor(() => {
      expect(screen.queryByRole('combobox', { name: /location/i })).toBeNull();
    });
  });
});