import type { KeyboardEvent, PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';

interface ConfidenceSliderProps {
  value: number | null;
  onChange: (value: number) => void;
  initial?: number;
}

const clamp = (value: number) => Math.min(100, Math.max(0, value));

const KEY_STEPS: Record<string, (value: number) => number> = {
  ArrowRight: (v) => v + 1,
  ArrowUp: (v) => v + 1,
  ArrowLeft: (v) => v - 1,
  ArrowDown: (v) => v - 1,
  PageUp: (v) => v + 10,
  PageDown: (v) => v - 10,
  Home: () => 0,
  End: () => 100,
};

/** Starts with no value, so a student is never nudged towards a preset number. */
export function ConfidenceSlider({ value, onChange, initial }: ConfidenceSliderProps) {
  const { t } = useTranslation();

  const onKeyDown = (event: KeyboardEvent) => {
    const step = KEY_STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    onChange(clamp(step(value ?? 0)));
  };

  const fromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const { left, width } = event.currentTarget.getBoundingClientRect();
    onChange(clamp(Math.round(((event.clientX - left) / width) * 100)));
  };

  return (
    <div className="stack">
      <div className="row">
        <span className="b">{t('student.confidence.label')}</span>
        <span className="sp" />
        {value === null ? null : <span className="b num">{value}</span>}
      </div>
      <div
        role="slider"
        tabIndex={0}
        aria-label={t('student.confidence.label')}
        aria-valuemin={0}
        aria-valuemax={100}
        {...(value === null ? {} : { 'aria-valuenow': value })}
        className={`slider ${value === null ? 'empty' : ''}`}
        onKeyDown={onKeyDown}
        onPointerDown={fromPointer}
      >
        {value === null ? null : (
          <>
            <span className="fill" style={{ width: `${value}%` }} />
            <span className="knob" style={{ left: `${value}%` }} />
          </>
        )}
        {initial === undefined ? null : <span className="knob orig" style={{ left: `${initial}%` }} aria-hidden="true" />}
      </div>
      <div className="ticks">
        <span>{t('student.confidence.low')}</span>
        <span>50</span>
        <span>{t('student.confidence.high')}</span>
      </div>
    </div>
  );
}
