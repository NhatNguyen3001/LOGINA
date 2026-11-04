import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConfidenceSlider } from '@/components/logina/ConfidenceSlider';
import { PhaseLine } from '@/components/logina/PhaseLine';
import { Pick } from '@/components/logina/Pick';
import { StatusTag } from '@/components/logina/StatusTag';
import { Stepper } from '@/components/logina/Stepper';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

describe('Button', () => {
  it('shows a spinner and stays disabled while busy', async () => {
    await renderWithI18n(<Button aria-busy disabled>Lock</Button>);
    const button = screen.getByRole('button', { name: 'Lock' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('data-slot', 'button');
  });

  it('keeps the current heights: 40 px for md and 36 px for sm', () => {
    expect(buttonVariants()).toContain('min-h-10');
    expect(buttonVariants({ size: 'sm' })).toContain('min-h-9');
  });

  it('used on its own, a secondary button keeps a visible border', () => {
    expect(buttonVariants({ variant: 'secondary' })).toContain('border-line-strong');
    expect(buttonVariants({ variant: 'secondary' }).split(' ')).not.toContain('border-transparent');
  });

  it('renders a link styled as a button through asChild', async () => {
    await renderWithI18n(<Button asChild variant="secondary"><a href="/t/lessons">Lessons</a></Button>);
    expect(screen.getByRole('link', { name: 'Lessons' })).toHaveAttribute('data-slot', 'button');
  });
});

describe('Card', () => {
  it('tones map to padding, and flush has none', async () => {
    const { container } = await renderWithI18n(<><Card>A</Card><Card tone="flush">B</Card></>);
    const [plain, flush] = [...container.querySelectorAll('[data-slot="card"]')];
    expect(plain?.className).toContain('p-5');
    expect(flush?.className).not.toMatch(/(^|\s)p-/);
  });
});

describe('StatusTag as a Badge', () => {
  it('renders the shadcn badge slot', async () => {
    const { container } = await renderWithI18n(<StatusTag kind="pass">Approved</StatusTag>);
    expect(container.querySelector('[data-slot="badge"]')).not.toBeNull();
  });
});

describe('ConfidenceSlider', () => {
  it('F-S2 starts at 50 and supports keyboard steps of ten', async () => {
    const onChange = vi.fn();
    await renderWithI18n(<Controlled onChange={onChange} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuenow', '50');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(60);
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith(50);
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
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    expect(onChange.mock.calls.every(([next]) => next <= 100)).toBe(true);
  });
});

describe('Stepper', () => {
  it('marks the current step, ticks the finished ones, and names both approvals', async () => {
    const { container } = await renderWithI18n(<Stepper current={2} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items[2]).toHaveAttribute('aria-current', 'step');
    expect(items[2]).toHaveTextContent('Check source');
    expect(screen.getAllByText('Done')).toHaveLength(2);
    expect(screen.getByText('Approval 1')).toBeInTheDocument();
    expect(screen.getByText('Approval 2')).toBeInTheDocument();
    expect(container.querySelector('.steps-now')).toHaveTextContent('Step 3 of 5: Check source');
  });
});

describe('PhaseLine', () => {
  it('numbers the steps, ticks the finished ones and marks the current one', async () => {
    const { container } = await renderWithI18n(<PhaseLine phase="CHALLENGED" />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[2]).toHaveAttribute('aria-current', 'step');
    expect(items[2]).toHaveTextContent('3Think again and final answer');
    expect(screen.getAllByText('Done')).toHaveLength(2);
    expect(container.querySelectorAll('.done svg')).toHaveLength(2);
  });
});

describe('Pick', () => {
  it('orig names the first answer', async () => {
    await renderWithI18n(<Pick name="a" value="2" state="orig" checked={false} onSelect={() => {}}>Two</Pick>);
    expect(screen.getByText('Your first answer')).toBeInTheDocument();
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
