import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toast } from '@/components/logina/Toast';
import { clearToast, showToast } from '@/lib/toast';
import { renderWithI18n } from './utils';

describe('Toast', () => {
  afterEach(() => act(() => clearToast()));

  it('a toast survives a page change and closes after 8 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    function App() {
      const [page, setPage] = useState('A');
      return <><Toast />{page === 'A' ? <button type="button" onClick={() => setPage('B')}>Go on</button> : <p>Page B</p>}</>;
    }
    await renderWithI18n(<App />, { lang: 'en' });
    act(() => showToast({ title: 'Jumped to T7', body: 'Open the lesson set.' }));
    expect(await screen.findByText('Jumped to T7')).toBeInTheDocument();
    expect(document.querySelector('[data-sonner-toaster]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Go on' }));
    expect(screen.getByText('Page B')).toBeInTheDocument();
    expect(screen.getByText('Jumped to T7')).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(8600); });
    await vi.waitFor(() => expect(screen.queryByText('Jumped to T7')).toBeNull());
    vi.useRealTimers();
  });

  it('announces a confirmation, and it can be dismissed', async () => {
    await renderWithI18n(<Toast />, { lang: 'en' });
    act(() => showToast({ title: 'Demo reset', body: 'Back at the start.' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Demo reset');
    expect(screen.getByRole('status')).toHaveTextContent('Back at the start.');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByText('Demo reset')).toBeNull());
  });
});
