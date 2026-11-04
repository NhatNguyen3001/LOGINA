import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConfidenceSlider, DEFAULT_CONFIDENCE } from '@/components/logina/ConfidenceSlider';
import { renderWithI18n } from './utils';

function Harness({ start = DEFAULT_CONFIDENCE, onChange = () => {} }: { start?: number; onChange?: (value: number) => void }) {
  const [value, setValue] = useState(start);
  return <ConfidenceSlider value={value} onChange={(next) => { setValue(next); onChange(next); }} />;
}

describe('confidence slider', () => {
  it('runs from 0 to 10, starts at 5 and moves one step at a time', async () => {
    const onChange = vi.fn();
    await renderWithI18n(<Harness onChange={onChange} />);
    const thumb = screen.getByRole('slider', { name: 'How sure are you?' });
    expect(thumb).toHaveAttribute('aria-valuenow', '5');
    expect(thumb).toHaveAttribute('aria-valuemax', '10');
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(6);
    fireEvent.keyDown(thumb, { key: 'End' });
    expect(thumb).toHaveAttribute('aria-valuenow', '10');
    fireEvent.keyDown(thumb, { key: 'Home' });
    expect(thumb).toHaveAttribute('aria-valuenow', '0');
  });

  it('marks every number from 0 to 10, with the words at the two ends', async () => {
    const { container } = await renderWithI18n(<Harness />);
    expect([...container.querySelectorAll('.conf-tick .n')].map((tick) => tick.textContent)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    expect(screen.getByText('Not sure')).toBeInTheDocument();
    expect(screen.getByText('Very sure')).toBeInTheDocument();
  });

  it('puts 5 exactly at the middle of the bar', async () => {
    const { container } = await renderWithI18n(<Harness />);
    const five = [...container.querySelectorAll<HTMLElement>('.conf-tick')].find((tick) => tick.textContent === '5')!;
    expect(five.style.left).toBe('calc(50% + 0px)');
  });
});
