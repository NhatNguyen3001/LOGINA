import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConfidenceSlider } from '@/components/logina/ConfidenceSlider';
import { Pick } from '@/components/logina/Pick';
import { StatusTag } from '@/components/logina/StatusTag';
import { Stepper } from '@/components/logina/Stepper';
import { StudentProgress } from '@/components/logina/StudentProgress';
import { renderWithI18n } from '../utils';

function Controlled({ onChange }: { onChange: (value: number) => void }) {
  const [value, setValue] = useState(50);
  return (
    <ConfidenceSlider
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe('StatusTag', () => {
  it.each(['pass', 'review', 'block', 'info', 'neutral', 'teacher', 'stale'] as const)('%s always renders an icon and text', async (kind) => {
    const { container } = await renderWithI18n(<StatusTag kind={kind}>Label</StatusTag>);
    expect(screen.getByText('Label')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

describe('ConfidenceSlider', () => {
  it('F-S2 starts at 50 and supports keyboard steps', async () => {
    const onChange = vi.fn();
    await renderWithI18n(<Controlled onChange={onChange} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuenow', '50');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(51);
    fireEvent.keyDown(slider, { key: 'PageUp' });
    expect(onChange).toHaveBeenLastCalledWith(61);
    fireEvent.keyDown(slider, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(100);
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('accepts any integer such as 73', async () => {
    await renderWithI18n(<ConfidenceSlider value={73} onChange={() => {}} />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '73');
    expect(screen.getByText('73')).toBeInTheDocument();
  });

  it('never goes below 0 or above 100', async () => {
    const onChange = vi.fn();
    await renderWithI18n(<ConfidenceSlider value={100} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'PageUp' });
    expect(onChange).toHaveBeenLastCalledWith(100);
  });
});

describe('Stepper', () => {
  it('marks the current step with aria-current and done steps with hidden text', async () => {
    await renderWithI18n(<Stepper current={2} />);
    const items = screen.getAllByRole('listitem');
    expect(items[2]).toHaveAttribute('aria-current', 'step');
    expect(items[1]).not.toHaveAttribute('aria-current');
    expect(screen.getAllByText('Done')).toHaveLength(2);
  });
});

describe('Pick', () => {
  it('new shows New and orig shows original', async () => {
    await renderWithI18n(
      <>
        <Pick name="a" value="1" state="new" checked={false} onSelect={() => {}}>One</Pick>
        <Pick name="a" value="2" state="orig" checked={false} onSelect={() => {}}>Two</Pick>
      </>,
    );
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('original')).toBeInTheDocument();
  });

  it('new shows Mới in Vietnamese', async () => {
    await renderWithI18n(<Pick name="a" value="1" state="new" checked={false} onSelect={() => {}}>One</Pick>, { lang: 'vi' });
    expect(screen.getByText('Mới')).toBeInTheDocument();
  });

  it('is a real radio, so the keyboard works', async () => {
    const onSelect = vi.fn();
    await renderWithI18n(<Pick name="a" value="1" checked={false} onSelect={onSelect}>One</Pick>);
    fireEvent.click(screen.getByRole('radio', { name: 'One' }));
    expect(onSelect).toHaveBeenCalledWith('1');
  });
});

describe('StudentProgress', () => {
  it('names the current task', async () => {
    await renderWithI18n(<StudentProgress slots={[{ slot: 'Q1', state: 'done' }, { slot: 'Q2', state: 'on' }]} />);
    expect(screen.getByText('Q2 Rank cards').closest('[aria-current]')).toHaveAttribute('aria-current', 'step');
  });
});
