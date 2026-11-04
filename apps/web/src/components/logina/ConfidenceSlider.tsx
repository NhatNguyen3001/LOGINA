import { useTranslation } from 'react-i18next';
import { Slider } from '@/components/ui/slider';

export const DEFAULT_CONFIDENCE = 5;

/** Answers locked before the switch to 0 to 10 were saved out of 100; they continue at the same point on the new scale. */
export const onTenPointScale = (value: number) => (value > 10 ? Math.round(value / 10) : value);

const MAX = 10;
const TICKS = Array.from({ length: MAX + 1 }, (_, index) => index);
/** Half the thumb's width. Radix keeps the thumb inside the bar, so each mark is shifted the same way to sit under it. */
const HALF_THUMB = 10;

/** Where a value sits along the bar, matching the thumb Radix keeps inside it. */
const tickLeft = (value: number) => {
  const percent = (value / MAX) * 100;
  return `calc(${percent}% + ${HALF_THUMB * (1 - percent / 50)}px)`;
};

interface ConfidenceSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function ConfidenceSlider({ value, onChange }: ConfidenceSliderProps) {
  const { t } = useTranslation();
  return (
    <div className="stack">
      <div className="row">
        <span className="b">{t('student.confidence.label')}</span>
        <span className="sp" />
        <span className="b num">{value}</span>
      </div>
      <Slider value={[value]} min={0} max={MAX} step={1} thumbLabel={t('student.confidence.label')} onValueChange={([next]) => onChange(next ?? value)} />
      <div className="conf-scale" aria-hidden="true">
        {TICKS.map((tick) => (
          <span key={tick} className={`conf-tick ${tick === value ? 'on' : ''}`} style={{ left: tickLeft(tick) }}>
            <span className="n">{tick}</span>
          </span>
        ))}
      </div>
      <div className="conf-ends">
        <span>{t('student.confidence.low')}</span>
        <span>{t('student.confidence.high')}</span>
      </div>
    </div>
  );
}
