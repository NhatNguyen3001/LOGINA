import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateBar } from '@/components/logina/UpdateBar';
import * as version from '@/lib/app-version';
import { useUnsavedText } from '@/lib/unsaved';
import { renderWithI18n } from './utils';

vi.mock('@/lib/app-version', async (original) => {
  const real = await original<typeof import('@/lib/app-version')>();
  return { ...real, reloadApp: vi.fn() };
});

function Editor({ dirty }: { dirty: boolean }) {
  useUnsavedText(dirty);
  return <textarea aria-label="Quick edit" defaultValue="typed" />;
}

const goOutdated = () => act(() => version.markOutdated());

beforeEach(() => vi.mocked(version.reloadApp).mockClear());

describe('update bar', () => {
  it('shows nothing while the app is current, but keeps an empty status region ready to announce', async () => {
    const { container } = await renderWithI18n(<UpdateBar />);
    expect(container.textContent).toBe('');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('the announcement is the message alone, with Reload outside it', async () => {
    await renderWithI18n(<UpdateBar />);
    goOutdated();
    expect(screen.getByRole('status')).toHaveTextContent(/^LOGINA has been updated\. Reload to get the latest version\.$/);
    expect(screen.getByRole('status')).not.toContainElement(screen.getByRole('button', { name: 'Reload' }));
  });

  it('shows the update message with Reload once a newer version is live, and Reload reloads', async () => {
    await renderWithI18n(<UpdateBar />);
    goOutdated();
    expect(screen.getByRole('status')).toHaveTextContent('LOGINA has been updated. Reload to get the latest version.');
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(version.reloadApp).toHaveBeenCalledTimes(1);
  });

  it('with unsaved teacher text it asks first; Keep editing keeps the page, Reload reloads', async () => {
    await renderWithI18n(<><UpdateBar /><Editor dirty /></>);
    goOutdated();
    expect(screen.getByRole('status')).toHaveTextContent('Save your changes first, then reload.');
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(screen.getByRole('alertdialog', { name: 'You have unsaved text. Reload anyway?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(version.reloadApp).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Reload' }).at(-1)!);
    expect(version.reloadApp).toHaveBeenCalledTimes(1);
  });

  it('text that is saved again stops counting as unsaved', async () => {
    const { rerender } = await renderWithI18n(<><UpdateBar /><Editor dirty /></>);
    goOutdated();
    rerender(<><UpdateBar /><Editor dirty={false} /></>);
    expect(screen.getByRole('status')).toHaveTextContent('Reload to get the latest version.');
  });
});
