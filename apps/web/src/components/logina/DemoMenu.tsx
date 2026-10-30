import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { demoFailNextRerun, demoReset, demoSimulate, getDemoSnapshots, getMe, getMyAssignments, newKey, restoreSnapshot } from '@/lib/api';
import { limitState, minutesUntil, useLimit, type Limit } from '@/lib/limits';
import { qk } from '@/lib/query';
import { Note } from './Note';

function LimitHint({ limit }: { limit: Limit | undefined }) {
  const { t } = useTranslation();
  if (!limit) return null;
  const state = limitState(limit);
  if (state === 'reached') return <span className="small muted">{t('demo.availableIn', { minutes: minutesUntil(limit.resetsAt) })}</span>;
  if (state === 'almost') return <span className="small muted">{t('demo.leftThisHour', { count: limit.remaining })}</span>;
  return null;
}

export function DemoMenu({ assignmentId }: { assignmentId?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [armed, setArmed] = useState(false);

  const me = useQuery({ queryKey: qk.me(), queryFn: getMe });
  const snapshots = useQuery({ queryKey: qk.snapshots(), queryFn: getDemoSnapshots, enabled: open });
  const assignments = useQuery({ queryKey: qk.myAssignments(), queryFn: getMyAssignments, enabled: open && !assignmentId });
  const reset = useLimit('RESET');
  const simulate = useLimit('SIMULATE_CLASS');
  const target = assignmentId ?? assignments.data?.assignments[0]?.assignmentId;
  const resetBlocked = reset ? limitState(reset) === 'reached' : false;
  const simulateBlocked = simulate ? limitState(simulate) === 'reached' : false;

  const afterChange = async () => {
    setOpen(false);
    setConfirming(false);
    await queryClient.invalidateQueries();
  };

  const run = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: afterChange,
    onError: () => queryClient.invalidateQueries({ queryKey: qk.limits() }),
  });

  const leaveToLessons = () => void navigate({ to: '/t/lessons' });

  if (!me.data?.demoMenu) return null;

  return (
    <div className="relative w-full">
      <button type="button" className="nav w-full" aria-expanded={open} onClick={() => setOpen(!open)}>
        <div className="av" aria-hidden="true">{t('demo.avatar')}</div>
        <span>{t('demo.title')}</span>
      </button>
      {open ? (
        <div className="card tight absolute bottom-full left-0 z-10 w-72 shadow-card">
          {run.isPending ? <p className="s13 muted">{t('common.loading')}</p> : null}
          {confirming ? (
            <>
              <p className="s13">{t('demo.resetConfirm')}</p>
              <div className="row">
                <button type="button" className="btn danger sm" onClick={() => run.mutate(() => demoReset(newKey()).then(leaveToLessons))}>{t('common.confirm')}</button>
                <button type="button" className="btn secondary sm" onClick={() => setConfirming(false)}>{t('common.cancel')}</button>
              </div>
            </>
          ) : (
            <>
              <button type="button" className="btn secondary sm block" disabled={resetBlocked || run.isPending} onClick={() => setConfirming(true)}>{t('demo.reset')}</button>
              <LimitHint limit={reset} />
              <button type="button" className="btn secondary sm block" disabled={!target || simulateBlocked || run.isPending} onClick={() => run.mutate(() => demoSimulate(target!, newKey()))}>{t('demo.simulate')}</button>
              <LimitHint limit={simulate} />
              {target ? null : <span className="small muted">{t('demo.noAssignment')}</span>}
              <button type="button" className="btn secondary sm block" onClick={() => void demoFailNextRerun(newKey()).then(() => setArmed(true))}>{t('demo.failRecheck')}</button>
              {armed ? <Note kind="info">{t('demo.armed')}</Note> : null}
              <span className="small b muted">{t('demo.jump')}</span>
              <span className="small muted">{t('demo.jumpSampleOnly')}</span>
              {snapshots.data?.snapshots.map(({ stepId, label }) => (
                <button key={stepId} type="button" className="btn secondary sm block" disabled={resetBlocked || run.isPending} onClick={() => run.mutate(() => restoreSnapshot(stepId, newKey()).then(leaveToLessons))}>{label}</button>
              ))}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
