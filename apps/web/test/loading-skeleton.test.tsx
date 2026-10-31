import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingSkeleton } from '@/components/logina/LoadingSkeleton';
import { renderWithI18n } from './utils';

describe('LoadingSkeleton', () => {
  it('shows shapes instead of words, and still tells a screen reader', async () => {
    const { container } = await renderWithI18n(<LoadingSkeleton />, { lang: 'en' });
    expect(screen.getByRole('status', { name: 'Loading…' })).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(container.querySelectorAll('.bone').length).toBeGreaterThan(1);
  });
});
