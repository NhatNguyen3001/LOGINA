import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Note } from '@/components/logina/Note';
import { PairGrid } from '@/components/logina/PairGrid';
import { errorKey } from '@/i18n';
import { ApiError, getLesson, getLogicReview, getPreview, newKey, sendEdit } from '@/lib/api';
import { qk } from '@/lib/query';

const TABS = ['pairs', 'prompts', 'adjust'] as const;

export function LogicPage() {
  const { t } = useTranslation();
  const { id } = useParams({ strict: false }) as { id: string };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>('pairs');
  const [challengeId, setChallengeId] = useState('');
  const [message, setMessage] = useState('');
  const logic = useQuery({ queryKey: qk.logic(id, 'Q1'), queryFn: () => getLogicReview(id, 'Q1') });
  const lesson = useQuery({ queryKey: qk.lesson(id), queryFn: () => getLesson(id) });
  const preview = useQuery({ queryKey: qk.preview(id, 'Q1'), queryFn: () => getPreview(id, 'Q1') });

  const save = useMutation({
    mutationFn: () =>
      sendEdit(id, { editScope: 'LOGIC', targetType: 'challenge', targetId: lesson.data!.currentTaskDraftIds.Q1!, changedRefs: [challengeId], baseVersion: preview.data!.draftVersion, payload: { challengeId, message } }, newKey()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['lesson', id] });
      await navigate({ to: '/t/lessons/$id/tasks/$slot', params: { id, slot: 'Q1' } });
    },
  });

  return (
    <>
      <div className="row">
        <Link to="/t/lessons/$id/tasks/$slot" params={{ id, slot: 'Q1' }} className="btn secondary sm">{t('teacher.t08.back')}</Link>
        <h1 className="h1">{t('teacher.t08.title')}</h1>
        <span className="tag info">{t('teacher.t08.advanced')}</span>
      </div>
      <div role="tablist" className="row">
        {TABS.map((name) => (
          <button key={name} type="button" role="tab" aria-selected={tab === name} className={`chip ${tab === name ? 'on' : ''}`} onClick={() => setTab(name)}>{t(`teacher.t08.tab.${name}`)}</button>
        ))}
      </div>
      {tab === 'pairs' && logic.data ? <PairGrid pairs={logic.data.pairs} /> : null}
      {tab === 'prompts'
        ? logic.data?.challenges.map((challenge) => (
            <div key={challenge.label} className={`cand ${challenge.isFallback ? 'fb' : ''}`}>
              <div className="row">
                <span className="tag info">{challenge.label}</span>
                <span className="s13 b">{challenge.purpose}</span>
              </div>
              <p className="msg">{challenge.message}</p>
              <span className="small muted">{challenge.whenShown}</span>
            </div>
          ))
        : null}
      {tab === 'adjust' ? (
        <div className="card">
          <div className="field">
            <label htmlFor="challenge">{t('teacher.t08.which')}</label>
            <select id="challenge" className="select" value={challengeId} onChange={(event) => setChallengeId(event.target.value)}>
              <option value="" disabled>{t('student.q4.choose')}</option>
              {logic.data?.boundedEditActions.map((action) => (
                <option key={action.challengeId} value={action.challengeId}>{action.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="message">{t('teacher.t08.message')}</label>
            <textarea id="message" className="textarea" value={message} onChange={(event) => setMessage(event.target.value)} />
          </div>
          <p className="s13 sec">{t('teacher.t08.invalidates')}</p>
          {save.isError ? <Note kind="err">{t(errorKey(save.error instanceof ApiError ? save.error.code : ''))}</Note> : null}
          <button type="button" className="btn primary self-start" disabled={!challengeId || !message.trim() || save.isPending} onClick={() => save.mutate()}>{t('teacher.t07.saveRecheck')}</button>
        </div>
      ) : null}
    </>
  );
}
