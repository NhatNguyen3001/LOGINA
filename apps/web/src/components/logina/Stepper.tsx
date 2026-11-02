import { Check, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const STAGES = [0, 1, 2, 3, 4] as const;
/** Which steps are approvals, and their number. There are exactly two. */
const APPROVALS: Partial<Record<number, number>> = { 2: 1, 4: 2 };

export function Stepper({ current }: { current: 0 | 1 | 2 | 3 | 4 }) {
  const { t } = useTranslation();
  return (
    <div className="steps">
      <ol>
        {STAGES.map((stage) => {
          const approval = APPROVALS[stage];
          const classes = [stage < current ? 'done' : '', stage === current ? 'on' : '', approval ? 'gate' : ''];
          return (
            <li key={stage} className={classes.filter(Boolean).join(' ')} {...(stage === current ? { 'aria-current': 'step' as const } : {})}>
              <span className="n" aria-hidden="true">{stage < current ? <Check className="ico" /> : stage + 1}</span>
              {stage < current ? <span className="vh">{t('common.done')}</span> : null}
              <span className="name">{t(`teacher.stepper.${stage}`)}</span>
              {approval ? (
                <span className="gi">
                  <ShieldCheck className="ico" aria-hidden="true" />
                  {t('teacher.approvalBadge', { n: approval })}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="steps-now" aria-hidden="true">{t('teacher.stepNow', { n: current + 1, name: t(`teacher.stepper.${current}`) })}</p>
    </div>
  );
}
