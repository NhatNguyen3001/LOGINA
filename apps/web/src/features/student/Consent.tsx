import { CURRENT_CONSENT_VERSION } from '@logina/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, EyeOff, FlaskConical, HandHeart, Sheet, type LucideIcon } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StudentShell } from '@/components/logina/StudentShell';
import { Note } from '@/components/logina/Note';
import { newKey, sendConsent } from '@/lib/api';
import { qk } from '@/lib/query';
import { cardVariants } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { errorText } from '@/lib/errors';

/** What a person needs in order to decide stays open. Where the data goes, how long it is kept and who runs the study are in the privacy policy. */
const POINTS: { icon: LucideIcon; title: string; lines: string[] }[] = [
  { icon: FlaskConical, title: 'aboutTitle', lines: ['about'] },
  { icon: Sheet, title: 'recordTitle', lines: ['record'] },
  { icon: EyeOff, title: 'namesTitle', lines: ['names'] },
  { icon: HandHeart, title: 'choiceTitle', lines: ['choice', 'withdraw'] },
];

export function Consent({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const key = useRef(newKey());
  const [code, setCode] = useState<string | null>(null);

  const choose = useMutation({
    mutationFn: () => sendConsent({ consentVersion: CURRENT_CONSENT_VERSION, choice: 'AGREED' }, key.current),
    onSuccess: async ({ consent, participantCode }) => {
      await queryClient.invalidateQueries({ queryKey: qk.me() });
      if (consent === 'AGREED' && participantCode) setCode(participantCode);
      else onDone();
    },
  });

  return (
    <StudentShell current={t('consent.title')}>
      {code ? (
        <>
          <div className={cardVariants({ tone: 'tight' })}>
            <h1 className="s15 b">{t('consent.thanks')}</h1>
            <div className="stack">
              <span className="small b sec">{t('consent.code')}</span>
              <span className="bb num text-2xl">{code}</span>
            </div>
            <p className="s13 sec">{t('consent.keepCode')}</p>
          </div>
          <button type="button" className={buttonVariants()} onClick={onDone}>{t('consent.continue')}</button>
        </>
      ) : (
        <>
          <h1 className="stem">{t('consent.title')}</h1>
          <div className={cn(cardVariants(), 'notice-card')}>
            {POINTS.map(({ icon: Icon, title, lines }) => (
              <div key={title} className="np">
                <span className="ni">
                  <Icon className="ico" aria-hidden="true" />
                </span>
                <div className="stack">
                  <span className="b">{t(`consent.${title}`)}</span>
                  {lines.map((line) => (
                    <span key={line} className="s15 sec">{t(`consent.${line}`)}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Link to="/privacy" className="policy-link">
            {t('consent.privacyLink')}
            <ArrowRight className="ico" aria-hidden="true" />
          </Link>
          {choose.isError ? <Note kind="err">{t(errorText(choose.error))}</Note> : null}
          <div className="row consent-choice">
            <span className="s13 muted num">{t('consent.version', { version: CURRENT_CONSENT_VERSION })}</span>
            <span className="sp" />
            <button type="button" className={buttonVariants()} aria-busy={choose.isPending} disabled={choose.isPending} onClick={() => choose.mutate()}>{t('consent.agree')}</button>
          </div>
        </>
      )}
    </StudentShell>
  );
}
