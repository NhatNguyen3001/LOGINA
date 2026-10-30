import { ShieldCheck } from 'lucide-react';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

const STAGES = [0, 1, 2, 3, 4] as const;
const APPROVAL_STAGES: number[] = [2, 4];

export function Stepper({ current }: { current: 0 | 1 | 2 | 3 | 4 }) {
  const { t } = useTranslation();
  return (
    <ol className="stepper">
      {STAGES.map((stage) => {
        const gate = APPROVAL_STAGES.includes(stage);
        const classes = [stage < current ? 'done' : '', stage === current ? 'on' : '', gate ? 'gate' : ''];
        return (
          <Fragment key={stage}>
            <li className={classes.filter(Boolean).join(' ')} {...(stage === current ? { 'aria-current': 'step' as const } : {})}>
              <span className="n" aria-hidden="true">{stage < current ? '✓' : stage + 1}</span>
              {stage < current ? <span className="vh">{t('common.done')}</span> : null}
              {t(`teacher.stepper.${stage}`)}
              {gate ? (
                <span className="gi">
                  <ShieldCheck className="ico" aria-hidden="true" />
                  {t('teacher.approvalBadge')}
                </span>
              ) : null}
            </li>
            {stage < 4 ? <span className="arr" aria-hidden="true">→</span> : null}
          </Fragment>
        );
      })}
    </ol>
  );
}
