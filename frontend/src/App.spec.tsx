import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import App from '@/App';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

/** Smoke test: the router mounts and the routes resolve. */
describe('App routing (Phase 3)', () => {
  it('Given the root path, When rendered, Then the accounts route is used', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1, name: /relay analytics/i })).toBeInTheDocument();
  });

  it('Given an unknown path, When rendered, Then the app falls back to a known route', () => {
    renderAt('/nonsense/path');
    expect(screen.getByRole('heading', { level: 1, name: /relay analytics/i })).toBeInTheDocument();
  });

  it('Given a non-numeric account id, When rendered, Then an error is shown instead of crashing', () => {
    renderAt('/accounts/not-a-number');
    expect(screen.getByRole('alert')).toHaveTextContent(/not valid/i);
  });
});