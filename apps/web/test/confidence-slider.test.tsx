import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConfidenceSlider } from '@/components/logina/ConfidenceSlider';
import { renderWithI18n } from './utils';

function Harness({ start = 50, onChange = () => {} }: { start?: number; onChange?: (value: number) => void }) {
  const [value, setValue] = useState(start);
  return <ConfidenceSlider value={value} onChange={(next) => { setValue(next); onChange(next); }} />;
}

describe('confidence slider', () => {
  it('moves in steps of ten from the keyboard', async () => {
    const onChange = vi.fn();
    await renderWithI18n(<Harness onChange={onChange} />);
    const thumb = screen.getByRole('slider', { name: 'How sure are you?' });
    expect(thumb).toHaveAttribute('aria-valuenow', '50');
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(60);
    expect(thumb).toHaveAttribute('aria-valuenow', '60');
    fireEvent.keyDown(thumb, { key: 'Home' });
    expect(thumb).toHaveAttribute('aria-valuenow', '0');
  });

  it('marks every ten under the bar, with the words at the two ends', async () => {
    const { container } = await renderWithI18n(<Harness />);
    expect([...container.querySelectorAll('.conf-tick .n')].map((tick) => tick.textContent)).toEqual(['0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '100']);
    expect(screen.getByText('Not sure')).toBeInTheDocument();
    expect(screen.getByText('Very sure')).toBeInTheDocument();
  });

  it('puts 50 exactly at the middle of the bar', async () => {
    const { container } = await renderWithI18n(<Harness />);
    const fifty = [...container.querySelectorAll<HTMLElement>('.conf-tick')].find((tick) => tick.textContent === '50')!;
    expect(fifty.style.left).toBe('calc(50% + 0px)');
  });
});
