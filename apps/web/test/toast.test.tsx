import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Toast } from '@/components/logina/Toast';
import { clearToast, showToast } from '@/lib/toast';
import { renderWithI18n } from './utils';

describe('Toast', () => {
  afterEach(() => act(() => clearToast()));

  it('announces a confirmation, and it can be dismissed', async () => {
    await renderWithI18n(<Toast />, { lang: 'en' });
    act(() => showToast({ title: 'Demo reset', body: 'Back at the start.' }));
    expect(screen.getByRole('status')).toHaveTextContent('Demo reset');
    expect(screen.getByRole('status')).toHaveTextContent('Back at the start.');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Demo reset')).toBeNull();
  });
});
