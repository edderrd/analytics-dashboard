import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AccountsPage } from '@/pages/AccountsPage';
import { AccountDetailPage } from '@/pages/AccountDetailPage';

/**
 * End-to-end user journey (AC-6.4) against a running backend.
 *
 * The question the ticket asks is "can a customer admin look at this on Monday
 * morning and act on it", so the journey is written as that person would walk
 * it: pick the customer, read the headline answer, find the site that moved,
 * then narrow the page to that site.
 *
 * Opt-in, because it needs the stack running:
 *   docker compose up -d --build
 *   RELAY_LIVE_API=1 VITE_API_BASE_URL=http://localhost:3000 \
 *     npm test --workspace frontend -- e2e
 */

const live = process.env.RELAY_LIVE_API === '1';

describe.skipIf(!live)('Monday morning journey', () => {
  it('Given the account list, When a customer admin opens a multi-location customer, Then they can read the answer without exporting anything (AC-6.4)', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<AccountsPage />} />
          <Route path="/accounts/:id" element={<AccountDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // 1. Choose the customer.
    const link = await screen.findByRole('link', { name: 'Metro Collision Centers' });
    expect(link).toHaveAttribute('href', '/accounts/6');
    await user.click(link);

    // 2. Read the headline answer for the latest complete week.
    expect(
      await screen.findByRole('heading', { name: /is this week normal for you\?/i }),
    ).toBeVisible();
    expect(screen.getByText(/Week of 20 Jul . 26 Jul 2026/)).toBeVisible();

    // Every metric is labelled, so nothing is left for the reader to interpret.
    // (Each label appears in the summary cards and again in the per-site table.)
    for (const label of ['Calls received', 'Leads created', 'Appointments set']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText(/usual week/i).length).toBeGreaterThan(0);

    // 3. Find the sites that need attention.
    const table = await screen.findByRole('table');
    expect(table).toHaveTextContent('Site A');
    expect(screen.getAllByText(/needs a look/i).length).toBeGreaterThan(0);

    // 4. Narrow the whole page to one of them.
    const picker = screen.getByRole('combobox', { name: /location/i });
    await user.selectOptions(picker, 'Site A');

    expect(
      await screen.findByRole('heading', { name: /is this week normal for Site A\?/i }),
    ).toBeVisible();
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /by location: Site A/i }),
      ).toBeVisible();
    });
  });

  it('Given a customer with no activity, When the admin opens them, Then the page explains why instead of failing (AC-6.4)', async () => {
    render(
      <MemoryRouter initialEntries={['/accounts/20']}>
        <Routes>
          <Route path="/accounts/:id" element={<AccountDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Quiet Harbor Spa' })).toBeVisible();
    expect(await screen.findByText(/no activity recorded/i)).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});