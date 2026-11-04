import { useTranslation } from 'react-i18next';
import { Slider } from '@/components/ui/slider';

export const DEFAULT_CONFIDENCE = 50;

const STEP = 10;
const TICKS = Array.from({ length: 100 / STEP + 1 }, (_, index) => index * STEP);
/** Half the thumb's width. Radix keeps the thumb inside the bar, so each mark is shifted the same way to sit under it. */
const HALF_THUMB = 10;

const tickLeft = (value: number) => `calc(${value}% + ${HALF_THUMB * (1 - value / 50)}px)`;

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
      <Slider value={[value]} min={0} max={100} step={STEP} thumbLabel={t('student.confidence.label')} onValueChange={([next]) => onChange(next ?? value)} />
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
