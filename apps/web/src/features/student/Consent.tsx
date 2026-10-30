import { CURRENT_CONSENT_VERSION } from '@logina/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, EyeOff, FlaskConical, HandHeart, Sheet, UserRound, Users, type LucideIcon } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Logo } from '@/components/logina/Logo';
import { Note } from '@/components/logina/Note';
import { newKey, sendConsent } from '@/lib/api';
import { qk } from '@/lib/query';
import { errorKey } from '@/i18n';
import { ApiError } from '@/lib/api';

const POINTS: { icon: LucideIcon; title: string; lines: string[] }[] = [
  { icon: FlaskConical, title: 'aboutTitle', lines: ['about'] },
  { icon: Sheet, title: 'recordTitle', lines: ['record'] },
  { icon: EyeOff, title: 'namesTitle', lines: ['names'] },
  { icon: Users, title: 'dataTitle', lines: ['data', 'limit'] },
  { icon: UserRound, title: 'whoTitle', lines: ['who'] },
  { icon: Clock, title: 'keptTitle', lines: ['kept'] },
  { icon: HandHeart, title: 'choiceTitle', lines: ['choice', 'withdraw'] },
];

export function Consent({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const key = useRef(newKey());
  const [code, setCode] = useState<string | null>(null);

  const choose = useMutation({
    mutationFn: (choice: 'AGREED' | 'DECLINED') => sendConsent({ consentVersion: CURRENT_CONSENT_VERSION, choice }, key.current),
    onSuccess: async ({ consent, participantCode }) => {
      await queryClient.invalidateQueries({ queryKey: qk.me() });
      if (consent === 'AGREED' && participantCode) setCode(participantCode);
      else onDone();
    },
  });

  return (
    <div className="min-h-dvh bg-page">
      <div className="stu-top pb-4">
        <div className="stu-in row">
          <Logo />
        </div>
      </div>
      {code ? (
        <div className="stu-in stu-body">
          <div className="card tight">
            <h1 className="s15 b">{t('consent.thanks')}</h1>
            <div className="stack">
              <span className="small b sec">{t('consent.code')}</span>
              <span className="bb num text-2xl">{code}</span>
            </div>
            <p className="s13 sec">{t('consent.keepCode')}</p>
          </div>
          <button type="button" className="btn primary" onClick={onDone}>{t('consent.continue')}</button>
        </div>
      ) : (
        <>
          <main className="stu-in stu-body">
            <h1 className="stem">{t('consent.title')}</h1>
            <div className="card notice-card">
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
            <Link to="/privacy" className="lnk">{t('consent.privacyLink')}</Link>
            {choose.isError ? <Note kind="err">{t(errorKey(choose.error instanceof ApiError ? choose.error.code : ''))}</Note> : null}
          </main>
          <div className="stu-foot">
            <div className="stu-in stack">
              <div className="egrid">
                <button type="button" className="btn secondary" disabled={choose.isPending} onClick={() => choose.mutate('AGREED')}>{t('consent.agree')}</button>
                <button type="button" className="btn secondary" disabled={choose.isPending} onClick={() => choose.mutate('DECLINED')}>{t('consent.decline')}</button>
              </div>
              <div className="row">
                <span className="s13 muted">{t('consent.once')}</span>
                <span className="sp" />
                <span className="s13 muted num">{t('consent.version', { version: CURRENT_CONSENT_VERSION })}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
