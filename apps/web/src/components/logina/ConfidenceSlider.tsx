import type { KeyboardEvent, PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';

export const DEFAULT_CONFIDENCE = 50;

interface ConfidenceSliderProps {
  value: number;
  onChange: (value: number) => void;
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

export function ConfidenceSlider({ value, onChange }: ConfidenceSliderProps) {
  const { t } = useTranslation();

  const onKeyDown = (event: KeyboardEvent) => {
    const step = KEY_STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    onChange(clamp(step(value)));
  };

  const fromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const { left, width } = event.currentTarget.getBoundingClientRect();
    onChange(clamp(Math.round(((event.clientX - left) / width) * 100)));
  };

  /** Capture keeps the drag alive when the pointer leaves the bar. */
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    fromPointer(event);
  };

  const drag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) fromPointer(event);
  };

  return (
    <div className="stack">
      <div className="row">
        <span className="b">{t('student.confidence.label')}</span>
        <span className="sp" />
        <span className="b num">{value}</span>
      </div>
      <div
        role="slider"
        tabIndex={0}
        aria-label={t('student.confidence.label')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className="slider"
        onKeyDown={onKeyDown}
        onPointerDown={startDrag}
        onPointerMove={drag}
      >
        <span className="fill" style={{ width: `${value}%` }} />
        <span className="knob" style={{ left: `${value}%` }} />
      </div>
      <div className="ticks">
        <span>{t('student.confidence.low')}</span>
        <span>50</span>
        <span>{t('student.confidence.high')}</span>
      </div>
    </div>
  );
}
