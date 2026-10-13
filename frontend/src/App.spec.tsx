import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import App from '@/App';

/**
 * Phase 0 scaffold check (AC-1.4): proves the sanity page mounts in a real DOM
 * and that shadcn/ui primitives render.
 */
describe('Phase 0 sanity page', () => {
  it('mounts and renders the scaffold verification card', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: /relay analytics/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/scaffold verification/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /default/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/phase 0 scaffold/i)).toBeInTheDocument();
  });

  it('applies shadcn/ui class wiring to the card', () => {
    const { container } = render(<App />);
    const card = container.querySelector('[data-slot="card"]');
    expect(card).not.toBeNull();
    expect(card?.className).toContain('rounded-xl');
  });
});