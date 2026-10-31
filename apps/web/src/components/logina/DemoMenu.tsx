import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { AlertTriangle, Compass, RotateCcw, Users, X, type LucideIcon } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { demoFailNextRerun, demoReset, demoSimulate, getDemoSnapshots, getMe, getMyAssignments, newKey, restoreSnapshot } from '@/lib/api';
import { qk } from '@/lib/query';
import { showToast, type ToastMessage } from '@/lib/toast';
import { Note } from './Note';

const TOUR = ['button', 'jump', 'try', 'reset'] as const;
const TOUR_SEEN = 'logina.demoTourSeen';
/** Long enough for the drawer to finish sliding in, so the spotlight lands where the part ends up. */
const DRAWER_MS = 240;
const NARROW_PX = 720;
const COACH_HEIGHT_PX = 220;
const GAP_PX = 16;

/** A browser that blocks storage counts as having seen it, or the tour would return on every page. */
const tourSeen = (): boolean => {
  try {
    return localStorage.getItem(TOUR_SEEN) === '1';
  } catch {
    return true;
  }
};

const markTourSeen = (): void => {
  try {
    localStorage.setItem(TOUR_SEEN, '1');
  } catch {
    // Nothing to do: the tour simply shows again next time.
  }
};

const showModal = (node: HTMLDialogElement | null) => {
  if (node && !node.open) node.showModal();
};

/** A modal focuses its first control, which here is Skip; the step's own action is the one to land on. */
const openOnNext = (node: HTMLDialogElement | null) => {
  if (!node || node.open) return;
  node.showModal();
  node.querySelector<HTMLElement>('.btn.primary')?.focus();
};

function coachPlace(box: DOMRect | null): CSSProperties {
  if (!box) return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
  const { innerWidth, innerHeight } = window;
  if (innerWidth < NARROW_PX) return box.top > innerHeight / 2 ? { left: GAP_PX, right: GAP_PX, top: GAP_PX } : { left: GAP_PX, right: GAP_PX, bottom: GAP_PX };
  if (box.left < innerWidth / 2) return { left: box.right + GAP_PX, bottom: Math.max(GAP_PX, innerHeight - box.bottom) };
  return { right: innerWidth - box.left + GAP_PX, top: Math.min(Math.max(GAP_PX, box.top), innerHeight - COACH_HEIGHT_PX) };
}

function Tour({ step, onNext, onSkip }: { step: number; onNext: () => void; onSkip: () => void }) {
  const { t } = useTranslation();
  const [box, setBox] = useState<DOMRect | null>(null);
  const part = TOUR[step]!;
  const last = step === TOUR.length - 1;

  useEffect(() => {
    const measure = () => {
      const found = document.querySelector(`[data-tour="${part}"]`)?.getBoundingClientRect();
      setBox(found && found.width > 0 ? found : null);
    };
    const timer = setTimeout(measure, DRAWER_MS);
    /** The jump list arrives after the drawer opens, and the spotlight has to grow with it. */
    const growth = new ResizeObserver(measure);
    const target = document.querySelector(`[data-tour="${part}"]`);
    if (target) growth.observe(target);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(timer);
      growth.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [part]);

  return (
    <dialog
      ref={openOnNext}
      className={`tour ${box ? '' : 'dim'}`}
      aria-labelledby="tour-title"
      onCancel={(event) => {
        event.preventDefault();
        onSkip();
      }}
    >
      {box ? <div className="tour-hole" style={{ top: box.top - 6, left: box.left - 6, width: box.width + 12, height: box.height + 12 }} /> : null}
      <div className="tour-coach" style={coachPlace(box)}>
        <h2 id="tour-title" className="s15 b">{t(`demo.tour.${part}Title`)}</h2>
        <p className="s13 sec">{t(`demo.tour.${part}Body`)}</p>
        <div className="row">
          <span className="tour-dots" role="img" aria-label={t('demo.tour.stepOf', { n: step + 1, total: TOUR.length })}>
            {TOUR.map((name, index) => <i key={name} className={index === step ? 'on' : undefined} />)}
          </span>
          <span className="sp" />
          {last ? null : <button type="button" className="lnk jump" onClick={onSkip}>{t('demo.tour.skip')}</button>}
          <button type="button" className="btn primary sm" onClick={onNext}>{t(last ? 'demo.tour.done' : 'demo.tour.next')}</button>
        </div>
      </div>
    </dialog>
  );
}

function Action({ icon: Icon, warn, title, note, disabled, onClick }: { icon: LucideIcon; warn?: boolean; title: string; note: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="demo-row" disabled={disabled} onClick={onClick}>
      <span className={`ni ${warn ? 'warn' : ''}`}><Icon className="ico" aria-hidden="true" /></span>
      <span className="grow">
        <span className="demo-name">{title}</span>
        <span className="demo-note">{note}</span>
      </span>
    </button>
  );
}

export function DemoMenu({ assignmentId }: { assignmentId?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [armed, setArmed] = useState(false);
  const [tourStep, setTourStep] = useState<number | null>(null);

  const me = useQuery({ queryKey: qk.me(), queryFn: getMe });
  const snapshots = useQuery({ queryKey: qk.snapshots(), queryFn: getDemoSnapshots, enabled: open });
  const assignments = useQuery({ queryKey: qk.myAssignments(), queryFn: getMyAssignments, enabled: open && !assignmentId });
  const target = assignmentId ?? assignments.data?.assignments[0]?.assignmentId;
  const offered = Boolean(me.data?.demoMenu);

  useEffect(() => {
    if (offered && !tourSeen()) setTourStep(0);
  }, [offered]);

  const close = () => {
    setOpen(false);
    setConfirming(false);
  };

  const run = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: async () => {
      close();
      await queryClient.invalidateQueries();
    },
  });

  /** The workspace was replaced, and its IDs repeat, so nothing cached may survive. */
  const replaceWorkspace = useMutation({
    mutationFn: ({ action }: { action: () => Promise<unknown>; done: ToastMessage }) => action(),
    onSuccess: async (_, { done }) => {
      close();
      queryClient.clear();
      await navigate({ to: '/t/lessons' });
      showToast(done);
    },
  });

  const pending = run.isPending || replaceWorkspace.isPending;

  const nextTourStep = () => {
    if (tourStep === TOUR.length - 1) {
      markTourSeen();
      setTourStep(null);
      return;
    }
    setOpen(true);
    setTourStep((tourStep ?? 0) + 1);
  };

  const skipTour = () => {
    markTourSeen();
    setTourStep(null);
    setOpen(false);
  };

  const replayTour = () => {
    close();
    setTourStep(0);
  };

  if (!offered) return null;

  return (
    <>
      <button type="button" data-tour="button" className="demo-open" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <Compass className="ico" aria-hidden="true" />
        <span>{t('demo.title')}</span>
      </button>
      {createPortal(
        <>
          {open ? (
            <dialog
              ref={showModal}
              className="drawer"
              aria-labelledby="demo-title"
              onClose={close}
              onClick={(event) => {
                if (event.target === event.currentTarget) close();
              }}
            >
              <div className="drawer-in">
                <div className="row">
                  <h2 id="demo-title" className="s15 b grow">{t('demo.title')}</h2>
                  <button type="button" className="ibtn" aria-label={t('demo.close')} onClick={close}><X className="ico" aria-hidden="true" /></button>
                </div>
                <p className="s13 sec">{t('demo.intro')}</p>
                {pending ? <p role="status" className="s13 muted">{t('common.loading')}</p> : null}
                <section className="demo-part" data-tour="jump">
                  <h3 className="small b sec">{t('demo.jump')}</h3>
                  <span className="small muted">{t('demo.jumpSampleOnly')}</span>
                  {snapshots.data?.snapshots.map(({ stepId, label }) => {
                    const [code = '', ...rest] = label.split(' · ');
                    return (
                      <button key={stepId} type="button" className="demo-row" disabled={pending} onClick={() => replaceWorkspace.mutate({ action: () => restoreSnapshot(stepId, newKey()), done: { title: t('demo.jumpedTitle', { step: label }), body: t('demo.jumpedBody') } })}>
                        <span className={`demo-chip ${code.startsWith('S') ? 's' : ''}`}>{code}</span>
                        <span className="grow">
                          <span className="demo-name">{rest.join(' · ') || code}</span>
                          <span className="demo-note">{t(`demo.step.${code}`, { defaultValue: '' })}</span>
                        </span>
                      </button>
                    );
                  })}
                </section>
                <section className="demo-part" data-tour="try">
                  <h3 className="small b sec">{t('demo.tryTitle')}</h3>
                  <Action icon={Users} title={t('demo.simulate')} note={t(target ? 'demo.simulateNote' : 'demo.noAssignment')} disabled={!target || pending} onClick={() => run.mutate(() => demoSimulate(target!, newKey()))} />
                  <Action icon={AlertTriangle} warn title={t('demo.failRecheck')} note={t('demo.failNote')} onClick={() => void demoFailNextRerun(newKey()).then(() => setArmed(true))} />
                  {armed ? <Note kind="info">{t('demo.armed')}</Note> : null}
                </section>
                <div className="drawer-end" data-tour="reset">
                  {confirming ? (
                    <>
                      <p className="s13">{t('demo.resetConfirm')}</p>
                      <div className="row">
                        <button type="button" className="btn danger sm" disabled={pending} onClick={() => replaceWorkspace.mutate({ action: () => demoReset(newKey()), done: { title: t('demo.resetDoneTitle'), body: t('demo.resetDoneBody') } })}>{t('common.confirm')}</button>
                        <button type="button" className="btn secondary sm" onClick={() => setConfirming(false)}>{t('common.cancel')}</button>
                      </div>
                    </>
                  ) : (
                    <button type="button" className="btn danger block" disabled={pending} onClick={() => setConfirming(true)}>
                      <RotateCcw className="ico" aria-hidden="true" />
                      {t('demo.reset')}
                    </button>
                  )}
                  <button type="button" className="btn choice block" onClick={replayTour}>
                    <Compass className="ico" aria-hidden="true" />
                    {t('demo.replay')}
                  </button>
                </div>
              </div>
            </dialog>
          ) : null}
          {tourStep === null ? null : <Tour key={tourStep} step={tourStep} onNext={nextTourStep} onSkip={skipTour} />}
        </>,
        document.body,
      )}
    </>
  );
}
