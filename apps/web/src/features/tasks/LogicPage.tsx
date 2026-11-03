import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Note } from '@/components/logina/Note';
import { PairGrid } from '@/components/logina/PairGrid';
import { errorKey } from '@/i18n';
import { ApiError, getLesson, getLogicReview, getPreview, newKey, sendEdit } from '@/lib/api';
import { qk } from '@/lib/query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { cn } from '@/lib/utils';

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
        <Link to="/t/lessons/$id/tasks/$slot" params={{ id, slot: 'Q1' }} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>{t('teacher.t08.back')}</Link>
        <h1 className="h1">{t('teacher.t08.title')}</h1>
        <Badge kind="info">{t('teacher.t08.advanced')}</Badge>
      </div>
      <Tabs value={tab} onValueChange={(value) => setTab(value as (typeof TABS)[number])} className="contents">
        <TabsList className="row">
          {TABS.map((name) => (
            <TabsTrigger key={name} value={name} className="chip">{t(`teacher.t08.tab.${name}`)}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="pairs" className="stack">{logic.data ? <PairGrid pairs={logic.data.pairs} /> : null}</TabsContent>
        <TabsContent value="prompts" className="stack">
          {logic.data?.challenges.map((challenge) => (
            <div key={challenge.label} className={`cand ${challenge.isFallback ? 'fb' : ''}`}>
              <div className="row">
                <Badge kind="info">{challenge.label}</Badge>
                <span className="s13 b">{challenge.purpose}</span>
              </div>
              <p className="msg">{challenge.message}</p>
              <span className="small muted">{challenge.whenShown}</span>
            </div>
          ))}
        </TabsContent>
        <TabsContent value="adjust">
        <div className={cardVariants()}>
          <div className="field">
            <label htmlFor="challenge">{t('teacher.t08.which')}</label>
            <Select value={challengeId} onValueChange={setChallengeId}>
              <SelectTrigger id="challenge"><SelectValue placeholder={t('student.q4.choose')} /></SelectTrigger>
              <SelectContent>
                {logic.data?.boundedEditActions.map((action) => (
                  <SelectItem key={action.challengeId} value={action.challengeId}>{action.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="field">
            <label htmlFor="message">{t('teacher.t08.message')}</label>
            <Textarea id="message" value={message} onChange={(event) => setMessage(event.target.value)} />
          </div>
          <p className="s13 sec">{t('teacher.t08.invalidates')}</p>
          {save.isError ? <Note kind="err">{t(errorKey(save.error instanceof ApiError ? save.error.code : ''))}</Note> : null}
          <button type="button" className={cn(buttonVariants(), 'self-start')} aria-busy={save.isPending} disabled={!challengeId || !message.trim() || save.isPending} onClick={() => save.mutate()}>{t('teacher.t07.saveRecheck')}</button>
        </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
