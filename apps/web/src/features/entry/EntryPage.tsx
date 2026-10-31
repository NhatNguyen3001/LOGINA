import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LangSwitch } from '@/components/logina/LangSwitch';
import { LegalFooter } from '@/components/logina/LegalFooter';
import { Logo } from '@/components/logina/Logo';
import { getMyAssignments, newKey, restartAttempt, updateMe } from '@/lib/api';
import { queryClient } from '@/lib/query';

export function EntryPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  /** A choice made here has no session yet, so it is saved on the way in. */
  const keepLanguage = async () => {
    if (i18n.language === 'vi') await updateMe({ uiLocale: 'vi' });
  };

  const tryTeacher = async () => {
    setPending(true);
    await keepLanguage();
    await navigate({ to: '/t/lessons' });
  };

  const tryStudent = async () => {
    setPending(true);
    await keepLanguage();
    const newest = (await getMyAssignments()).assignments[0];
    /** A finished run is filed away, so every try is a real one. */
    if (newest?.status === 'COMPLETE') {
      await restartAttempt(newest.assignmentId, newKey());
      queryClient.clear();
    }
    await (newest ? navigate({ to: '/s/assignments/$id', params: { id: newest.assignmentId } }) : navigate({ to: '/s/assignments' }));
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="login grow">
        <div className="login-brand">
          <Logo />
          <h1 className="login-h">{t('entry.headline')}</h1>
        </div>
        <div className="login-side">
          <div className="card login-card">
            <div className="row">
              <h2 className="text-2xl font-semibold">{t('entry.title')}</h2>
              <span className="sp" />
              <LangSwitch />
            </div>
            <div className="stack">
              <button type="button" className="btn secondary block" disabled={pending} onClick={() => void tryTeacher()}>{t('entry.teacher')}</button>
              <button type="button" className="btn secondary block" disabled={pending} onClick={() => void tryStudent()}>{t('entry.student')}</button>
            </div>
            <p className="small muted">{t('entry.demoLine')}</p>
          </div>
        </div>
      </div>
      <LegalFooter />
    </div>
  );
}
