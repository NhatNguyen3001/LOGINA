import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StudentShell } from '@/components/logina/StudentShell';
import { useSessionLocale } from '@/components/logina/TeacherShell';
import { getMe, newKey, startAttempt } from '@/lib/api';
import { qk } from '@/lib/query';
import { Consent } from './Consent';

/** Consent comes first, then the attempt starts or resumes at its first open task. */
export function OpenAssignment() {
  const { t } = useTranslation();
  const { id } = useParams({ strict: false }) as { id: string };
  useSessionLocale();

  /** Stays true after the choice is saved, so the participant code is on screen until they continue. */
  const [consenting, setConsenting] = useState(false);
  const me = useQuery({ queryKey: qk.me(), queryFn: getMe });
  if (me.data?.consentRequired && !consenting) setConsenting(true);
  const ready = me.data ? !me.data.consentRequired && !consenting : false;
  const attempt = useQuery({ queryKey: ['start-attempt', id], queryFn: () => startAttempt(id, newKey()), enabled: ready, gcTime: 0 });

  if (consenting) return <Consent onDone={() => setConsenting(false)} />;

  if (attempt.isError) {
    return (
      <StudentShell title={t('student.goneAfterReset')}>
        <Link to="/s/assignments" className="btn primary">{t('student.openNewSet')}</Link>
      </StudentShell>
    );
  }
  if (!attempt.data) return <p className="p-6 muted">{t('common.loading')}</p>;

  const { attemptId, status, slots } = attempt.data;
  if (status === 'COMPLETE') return <Navigate to="/s/attempts/$id/results" params={{ id: attemptId }} replace />;
  const next = slots.find((s) => s.phase !== 'SUBMITTED') ?? slots[0]!;
  return <Navigate to="/s/attempts/$id/$slot" params={{ id: attemptId, slot: next.slot }} replace />;
}
