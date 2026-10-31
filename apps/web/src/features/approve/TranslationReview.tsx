import type { Slot, TaskApprovalDTO } from '@logina/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Note } from '@/components/logina/Note';
import { StatusTag } from '@/components/logina/StatusTag';
import { editTranslation, newKey, retryTranslation } from '@/lib/api';
import { qk } from '@/lib/query';

type Task = TaskApprovalDTO['tasks'][number];
type Translation = NonNullable<Task['translation']>;

const STATUS_KIND = { WORKING: 'info', READY: 'pass', NEEDS_REVIEW: 'review', BLOCKED: 'block', FAILED: 'block' } as const;

/** Only the check's verdict is shown here; a review finding is decided with the task's other warnings. */
function Line({ lessonId, slot, translation, from, to }: { lessonId: string; slot: Slot; translation: Translation; from: string; to: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(to);
  const save = useMutation({
    mutationFn: () => editTranslation(lessonId, slot, { from, to: value, translationVersion: translation.version }, newKey()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.approval(lessonId) }),
  });

  return (
    <div className="pair-line">
      <span className="s13">{from}</span>
      {editing ? (
        <div className="stack">
          <textarea className="textarea" aria-label={from} lang={translation.locale} value={value} onChange={(event) => setValue(event.target.value)} />
          <button type="button" className="btn secondary sm self-start" disabled={!value.trim() || value === to || save.isPending} onClick={() => save.mutate()}>{t('teacher.t12.translation.save')}</button>
        </div>
      ) : (
        <div className="stack">
          <span className="s13" lang={translation.locale}>{to}</span>
          <button type="button" className="lnk jump self-start s13" onClick={() => setEditing(true)}>{t('teacher.t12.translation.edit')}</button>
        </div>
      )}
    </div>
  );
}

export function TranslationReview({ lessonId, task }: { lessonId: string; task: Task }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const translation = task.translation;
  const retry = useMutation({
    mutationFn: () => retryTranslation(lessonId, task.slot, newKey()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.approval(lessonId) }),
  });
  const canRetry = !translation || translation.status === 'FAILED';
  const blockers = translation?.findings.filter((finding) => finding.status === 'BLOCKER') ?? [];

  return (
    <section className="card" aria-label={t('teacher.t12.translation.title', { slot: task.slot })}>
      <div className="row">
        <h3 className="s15 b">{t('teacher.t12.translation.title', { slot: task.slot })}</h3>
        <span className="sp" />
        {translation ? <StatusTag kind={STATUS_KIND[translation.status]}>{t(`teacher.t12.translation.status.${translation.status}`)}</StatusTag> : null}
      </div>
      {canRetry ? (
        <div className="row">
          <span className="s13 sec grow">{t('teacher.t12.translation.missing')}</span>
          <button type="button" className="btn secondary sm" disabled={retry.isPending} onClick={() => retry.mutate()}>{t('teacher.t12.translation.retry')}</button>
        </div>
      ) : null}
      {blockers.map((finding) => (
        <Note key={finding.findingCode} kind="err">{finding.explanationForTeacher}</Note>
      ))}
      {translation?.texts.map(({ from, to }) => (
        <Line key={`${from}-${to}`} lessonId={lessonId} slot={task.slot} translation={translation} from={from} to={to} />
      ))}
      {translation && Object.keys(translation.keywords).length > 0 ? (
        <div className="well stack">
          <span className="small b sec">{t('teacher.t12.translation.keywords')}</span>
          {Object.entries(translation.keywords).map(([name, words]) => (
            <div key={name} className="row top">
              <span className="s13 b">{name}</span>
              <span className="s13" lang={translation.locale}>{words.join(', ')}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
