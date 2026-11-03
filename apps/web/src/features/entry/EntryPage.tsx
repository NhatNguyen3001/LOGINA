import { useNavigate } from '@tanstack/react-router';
import { Check, ClipboardCheck, PencilLine, type LucideIcon } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LangSwitch } from '@/components/logina/LangSwitch';
import { LegalFooter } from '@/components/logina/LegalFooter';
import { Logo } from '@/components/logina/Logo';
import { Note } from '@/components/logina/Note';
import { getMyAssignments, newKey, restartAttempt, updateMe } from '@/lib/api';
import { queryClient } from '@/lib/query';

/** Who does each step: the hand-off from teacher to students is the point of the strip. */
const HOW = [
  { step: 'add', who: 'teacher' },
  { step: 'draft', who: 'logina' },
  { step: 'approve', who: 'teacher' },
  { step: 'think', who: 'students' },
] as const;

const STEPS = [0, 1, 2, 3, 4] as const;

/** A small, still picture of the teacher side: the five steps, two already done. */
function TeacherPreview() {
  const { t } = useTranslation();
  return (
    <div className="role-preview" aria-hidden="true">
      <ol className="mini-steps">
        {STEPS.map((index) => (
          <li key={index} className={index < 2 ? 'done' : index === 2 ? 'on' : undefined}>
            <span className="mini-n">{index < 2 ? <Check className="size-3" /> : index + 1}</span>
            <span className="mini-l">{t(`teacher.stepper.${index}`)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** A small, still picture of the student side: an answer chosen, then how sure they are. */
function StudentPreview() {
  const { t } = useTranslation();
  return (
    <div className="role-preview" aria-hidden="true">
      <div className="mini-pick">
        <span className="mini-radio" />
        <span>{t('entry.preview.choice')}</span>
      </div>
      <div className="mini-sure">
        <span>{t('student.confidence.label')}</span>
        <span className="mini-track"><i /></span>
      </div>
    </div>
  );
}

function RoleCard({ icon: Icon, title, note, busy, disabled, onClick, children }: { icon: LucideIcon; title: string; note: string; busy: boolean; disabled: boolean; onClick: () => void; children: ReactNode }) {
  const id = useId();
  return (
    <button type="button" className="role-card" aria-labelledby={`${id}-t`} aria-describedby={`${id}-n`} aria-busy={busy} disabled={disabled} onClick={onClick}>
      <span className="role-head">
        <span className="role-ic"><Icon className="size-5" aria-hidden="true" /></span>
        <span id={`${id}-t`} className="role-title">{title}</span>
      </span>
      <span id={`${id}-n`} className="role-note">{note}</span>
      {children}
    </button>
  );
}

export function EntryPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [pending, setPending] = useState<'teacher' | 'student' | null>(null);
  const [failed, setFailed] = useState(false);

  /** A choice made here has no session yet, so it is saved on the way in. */
  const keepLanguage = async () => {
    if (i18n.language === 'vi') await updateMe({ uiLocale: 'vi' });
  };

  const enter = async (side: 'teacher' | 'student', go: () => Promise<unknown>) => {
    setPending(side);
    setFailed(false);
    try {
      await keepLanguage();
      await go();
    } catch {
      setPending(null);
      setFailed(true);
    }
  };

  const tryTeacher = () => enter('teacher', () => navigate({ to: '/t/lessons' }));

  const tryStudent = () =>
    enter('student', async () => {
      const newest = (await getMyAssignments()).assignments[0];
      /** A finished run is filed away, so every try is a real one. */
      if (newest?.status === 'COMPLETE') {
        await restartAttempt(newest.assignmentId, newKey());
        queryClient.clear();
      }
      await (newest ? navigate({ to: '/s/assignments/$id', params: { id: newest.assignmentId } }) : navigate({ to: '/s/assignments' }));
    });

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <header className="entry-top">
        <Logo />
        <LangSwitch />
      </header>
      <main className="entry">
        <div className="entry-intro">
          <h1 className="entry-h">{t('entry.headline')}</h1>
          <p className="entry-lede">{t('entry.lede')}</p>
        </div>
        <div className="role-grid">
          <RoleCard icon={ClipboardCheck} title={t('entry.teacher')} note={t('entry.teacherNote')} busy={pending === 'teacher'} disabled={pending !== null} onClick={() => void tryTeacher()}>
            <TeacherPreview />
          </RoleCard>
          <RoleCard icon={PencilLine} title={t('entry.student')} note={t('entry.studentNote')} busy={pending === 'student'} disabled={pending !== null} onClick={() => void tryStudent()}>
            <StudentPreview />
          </RoleCard>
        </div>
        <p role="status" className="s13 sec min-h-5">{pending ? t('entry.setup') : null}</p>
        {failed ? <Note kind="err">{t('errors.generic')}</Note> : null}
        <section className="entry-how" aria-labelledby="how-title">
          <h2 id="how-title" className="entry-how-h">{t('entry.howTitle')}</h2>
          <ol className="how-strip">
            {HOW.map(({ step, who }, index) => (
              <li key={step}>
                <span className="how-n">{index + 1}</span>
                <span className="how-who">{t(`entry.who.${who}`)}</span>
                <span className="how-text">{t(`entry.how.${step}`)}</span>
              </li>
            ))}
          </ol>
        </section>
        <p className="s13 muted">{t('entry.demoLine')}</p>
      </main>
      <LegalFooter />
    </div>
  );
}
