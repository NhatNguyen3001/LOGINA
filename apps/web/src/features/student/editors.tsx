import { closestCenter, DndContext, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Artifact, DraftArtifact, Q2TaskBody, Q3TaskBody, Q4TaskBody, Q5TaskBody, StudentTaskDTO } from '@logina/contracts';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pick } from '@/components/logina/Pick';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cardVariants } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Draft<S extends Artifact['slot']> = Extract<DraftArtifact, { slot: S }>;

interface EditorProps<S extends Artifact['slot'], B> {
  body: B;
  value: Draft<S>;
  onChange: (next: Draft<S>) => void;
  original?: Extract<Artifact, { slot: S }> | undefined;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const letterOf = (index: number): string => LETTERS[index] ?? String(index + 1);

const pickState = (id: string, chosen: string | undefined, original: string | undefined) => (id === original && id !== chosen ? ('orig' as const) : ('default' as const));

type Q1Task = Extract<StudentTaskDTO, { slot: 'Q1' }>;

export function Q1Editor({ task, value, onChange, original }: { task: Q1Task; value: Draft<'Q1'>; onChange: (next: Draft<'Q1'>) => void; original?: Extract<Artifact, { slot: 'Q1' }> | undefined }) {
  const { t } = useTranslation();
  return (
    <>
      <h2 className="s15 b">{t('student.answer.chooseStatement')}</h2>
      <div className="stack" role="radiogroup" aria-label={t('student.answer.chooseStatement')}>
        {task.answers.map(({ id, text }, index) => (
          <Pick key={id} name="answer" value={id} label={`${letterOf(index)}.`} checked={value.answerId === id} state={pickState(id, value.answerId, original?.answerId)} onSelect={(answerId) => onChange({ ...value, answerId })}>
            {text}
          </Pick>
        ))}
      </div>
      <h2 className="s15 b">{t('student.answer.chooseCard')}</h2>
      <div className="egrid" role="radiogroup" aria-label={t('student.answer.chooseCard')}>
        {task.evidence.map(({ id, text }, index) => (
          <Pick key={id} name="evidence" value={id} label={`${letterOf(index)}.`} checked={value.evidenceId === id} state={pickState(id, value.evidenceId, original?.evidenceId)} onSelect={(evidenceId) => onChange({ ...value, evidenceId })}>
            {text}
          </Pick>
        ))}
      </div>
    </>
  );
}

function RankRow({ id, index, count, text, onMove }: { id: string; index: number; count: number; text: string; onMove: (by: number) => void }) {
  const { t } = useTranslation();
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Translate.toString(transform && { ...transform, x: 0 }), transition };

  return (
    <li className="rank">
      {/* The number is the rank, so it stays in place and only the card moves. */}
      <span className="k">{index + 1}</span>
      <div ref={setNodeRef} style={style} className={`opt rank-card ${isDragging ? 'dragging' : ''}`} {...listeners}>
        <GripVertical className="ico grip" aria-hidden="true" />
        <span>{text}</span>
        {/* The row starts a drag, so the buttons keep their own presses. */}
        <span className="acts" onMouseDown={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()}>
          <button type="button" className={buttonVariants({ variant: 'secondary', size: 'icon' })} aria-label={t('student.q2.moveUp', { card: text })} disabled={index === 0} onClick={() => onMove(-1)}>
            <ArrowUp className="ico" aria-hidden="true" />
          </button>
          <button type="button" className={buttonVariants({ variant: 'secondary', size: 'icon' })} aria-label={t('student.q2.moveDown', { card: text })} disabled={index === count - 1} onClick={() => onMove(1)}>
            <ArrowDown className="ico" aria-hidden="true" />
          </button>
        </span>
      </div>
    </li>
  );
}

export function Q2Editor({ body, value, onChange }: EditorProps<'Q2', Q2TaskBody>) {
  const { t } = useTranslation();
  /** On touch, a short hold starts the drag, so a swipe over the cards still scrolls the page. */
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );
  const order = value.orderedCardIds ?? body.cards.map((c) => c.cardId);
  const textOf = (id: string) => body.cards.find((c) => c.cardId === id)?.text ?? id;

  const place = (from: number, to: number) => onChange({ ...value, orderedCardIds: arrayMove(order, from, to) });

  const drop = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) place(order.indexOf(String(active.id)), order.indexOf(String(over.id)));
  };

  return (
    <>
      <p className="s15 sec">{t('student.q2.instructions')}</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={drop}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ol className="stack">
            {order.map((id, index) => (
              <RankRow key={id} id={id} index={index} count={order.length} text={textOf(id)} onMove={(by) => place(index, index + by)} />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </>
  );
}

export function Q3Editor({ body, value, onChange, original }: EditorProps<'Q3', Q3TaskBody>) {
  const { t } = useTranslation();
  const tradeOffs = body.tradeOffs.filter((tradeOff) => tradeOff.optionId === value.judgmentOptionId);
  const tradeOff = tradeOffs.find((item) => item.tradeOffId === value.tradeOffId);

  return (
    <>
      <h2 className="s15 b">{t('student.q3.decide')}</h2>
      <div className="stack" role="radiogroup" aria-label={t('student.q3.decide')}>
        {body.options.map(({ optionId, text }, index) => (
          <Pick key={optionId} name="judgment" value={optionId} label={`${letterOf(index)}.`} checked={value.judgmentOptionId === optionId} state={pickState(optionId, value.judgmentOptionId, original?.judgmentOptionId)} onSelect={(judgmentOptionId) => onChange({ slot: 'Q3', judgmentOptionId })}>
            {text}
          </Pick>
        ))}
      </div>
      <h2 className="s15 b part">{t('student.q3.giveUp')}</h2>
      {tradeOffs.length === 0 ? <p className="q3-wait">{t('student.q3.waitPath')}</p> : null}
      <div className="stack" role="radiogroup" aria-label={t('student.q3.giveUp')}>
        {tradeOffs.map(({ tradeOffId, text }) => (
          <Pick key={tradeOffId} name="tradeOff" value={tradeOffId} checked={value.tradeOffId === tradeOffId} state={pickState(tradeOffId, value.tradeOffId, original?.tradeOffId)} onSelect={(id) => onChange({ slot: 'Q3', judgmentOptionId: value.judgmentOptionId!, tradeOffId: id })}>
            {text}
          </Pick>
        ))}
      </div>
      <h2 className="s15 b part">{t('student.q3.why')}</h2>
      {tradeOff ? <p className="s13 sec">{t('student.q3.whyHint')}</p> : <p className="q3-wait">{t('student.q3.waitCost')}</p>}
      <div className="stack" role="radiogroup" aria-label={t('student.q3.why')}>
        {tradeOff?.reasons.map(({ reasonId, text }) => (
          <Pick key={reasonId} name="reason" value={reasonId} checked={value.reasonId === reasonId} state={pickState(reasonId, value.reasonId, original?.reasonId)} onSelect={(id) => onChange({ ...value, reasonId: id })}>
            {text}
          </Pick>
        ))}
      </div>
    </>
  );
}

/** The argument with the student's cards in it, standing out from the frame's own words. */
export function FilledFrame({ body, placements }: { body: Q4TaskBody; placements: { slotId: string; cardId: string }[] }) {
  const textOf = (slotId: string) => {
    const cardId = placements.find((x) => x.slotId === slotId)?.cardId;
    return body.cards.find((x) => x.cardId === cardId)?.text;
  };
  return (
    <p className="ans fills">
      {body.frame.split(/(\[[^\]]+\])/).map((part, index) => {
        const slotId = /^\[(.+)\]$/.exec(part)?.[1];
        return slotId ? <mark key={index}>{textOf(slotId) ?? '____'}</mark> : part;
      })}
    </p>
  );
}

export function Q4Editor({ body, value, onChange }: EditorProps<'Q4', Q4TaskBody>) {
  const { t } = useTranslation();
  const [held, setHeld] = useState<string | null>(null);
  const placements = value.placements ?? [];
  const cardIn = (slotId: string) => placements.find((x) => x.slotId === slotId)?.cardId;
  const free = body.cards.filter((card) => !placements.some((x) => x.cardId === card.cardId));

  /** Kept in the order of the blanks, because that order decides the Think-again prompt. */
  const save = (slotId: string, cardId: string | null) => {
    const next = (id: string) => (id === slotId ? cardId : cardIn(id));
    onChange({ ...value, placements: body.slots.flatMap(({ slotId: id }) => (next(id) ? [{ slotId: id, cardId: next(id)! }] : [])) });
  };

  const tapBlank = (slotId: string) => {
    if (held) save(slotId, held);
    else if (cardIn(slotId)) save(slotId, null);
    setHeld(null);
  };

  return (
    <>
      <FilledFrame body={body} placements={placements} />
      <h2 className="s15 b">{t('student.q4.cards')}</h2>
      <p className="s13 sec">{t('student.q4.cardsHint')}</p>
      <div className="card-bank">
        {free.map(({ cardId, text }) => (
          <button key={cardId} type="button" className={`word-card ${held === cardId ? 'on' : ''}`} aria-pressed={held === cardId} onClick={() => setHeld(held === cardId ? null : cardId)}>{text}</button>
        ))}
      </div>
      {body.slots.map(({ slotId, label }) => {
        const card = body.cards.find((x) => x.cardId === cardIn(slotId));
        return (
          <div key={slotId} className="field">
            <span className="b" id={`blank-${slotId}`}>{label}</span>
            <button type="button" aria-describedby={`blank-${slotId}`} className={`blank ${card ? 'full' : held ? 'ready' : ''}`} onClick={() => tapBlank(slotId)}>
              {card?.text ?? t(held ? 'student.q4.placeHere' : 'student.q4.chooseCard')}
            </button>
          </div>
        );
      })}
    </>
  );
}

const DECLARATIONS = [
  { kind: 'DONT_KNOW', key: 'student.q5.dontKnow' },
  { kind: 'NOT_ENOUGH', key: 'student.q5.notEnough' },
] as const;

type Q5Answer = Extract<Artifact, { slot: 'Q5' }>['answers'][number];

function StarterField({ id, lead, answer, max, onChange }: { id: string; lead: string; answer: Q5Answer | undefined; max: number; onChange: (next: Q5Answer | null) => void }) {
  const { t } = useTranslation();
  const typed = answer?.declared ? '' : (answer?.text ?? '');
  return (
    <div className={cn(cardVariants({ tone: 'tight' }), 'starter')}>
      <label htmlFor={id} className="b s15">{lead}</label>
      <Input id={id} maxLength={max} disabled={Boolean(answer?.declared)} placeholder={t('student.q5.placeholder')} value={typed} onChange={(event) => onChange(event.target.value ? { starterId: id, text: event.target.value } : null)} />
      <div className="row">
        {DECLARATIONS.map(({ kind, key }) => (
          <button key={kind} type="button" className={`word-card s13 ${answer?.declared === kind ? 'on' : ''}`} aria-pressed={answer?.declared === kind} onClick={() => onChange(answer?.declared === kind ? null : { starterId: id, text: t(key), declared: kind })}>{t(key)}</button>
        ))}
        <span className="sp" />
        <span className="hint num">{`${typed.length}/${max}`}</span>
      </div>
    </div>
  );
}

export function Q5Editor({ body, value, onChange }: EditorProps<'Q5', Q5TaskBody>) {
  const answers = value.answers ?? [];
  const answerTo = (id: string) => answers.find((a) => a.starterId === id);

  /** Kept in the order of the sentences, because that order decides the Think-again prompt. */
  const save = (id: string, next: Q5Answer | null) => {
    onChange({ ...value, answers: body.starters.flatMap(({ starterId }) => {
      const answer = starterId === id ? next : answerTo(starterId);
      return answer ? [answer] : [];
    }) });
  };

  return (
    <>
      <p className="s15 sec">{body.instructions}</p>
      {body.starters.map(({ starterId, text }) => (
        <StarterField key={starterId} id={starterId} lead={text} answer={answerTo(starterId)} max={body.maxCharsPerField} onChange={(next) => save(starterId, next)} />
      ))}
    </>
  );
}

export function ArtifactEditor({ task, value, onChange, original }: { task: StudentTaskDTO; value: DraftArtifact; onChange: (next: DraftArtifact) => void; original?: Artifact | undefined }) {
  const props = { onChange: onChange as never, original: original as never };
  if (task.slot === 'Q1') return <Q1Editor task={task} value={value as Draft<'Q1'>} {...props} />;
  if (task.slot === 'Q2') return <Q2Editor body={task.taskBody} value={value as Draft<'Q2'>} {...props} />;
  if (task.slot === 'Q3') return <Q3Editor body={task.taskBody} value={value as Draft<'Q3'>} {...props} />;
  if (task.slot === 'Q4') return <Q4Editor body={task.taskBody} value={value as Draft<'Q4'>} {...props} />;
  return <Q5Editor body={task.taskBody} value={value as Draft<'Q5'>} {...props} />;
}

/** A complete draft is what the lock and submit requests need; the draft type allows gaps. */
export function isComplete(task: StudentTaskDTO, value: DraftArtifact): value is Artifact {
  if (value.slot === 'Q1') return Boolean(value.answerId && value.evidenceId);
  if (value.slot === 'Q2') return Boolean(value.orderedCardIds?.length);
  if (value.slot === 'Q3') return Boolean(value.judgmentOptionId && value.tradeOffId && value.reasonId);
  if (value.slot === 'Q4' && task.slot === 'Q4') return task.taskBody.slots.every((s) => value.placements?.some((x) => x.slotId === s.slotId));
  if (value.slot === 'Q5' && task.slot === 'Q5') return task.taskBody.starters.every((s) => value.answers?.some((a) => a.starterId === s.starterId && a.text.trim()));
  return false;
}

/** Names the first thing still missing, so a disabled Continue always says why. */
export function missingKey(task: StudentTaskDTO, value: DraftArtifact): string | null {
  if (value.slot === 'Q1') {
    if (!value.answerId) return 'student.need.statement';
    return value.evidenceId ? null : 'student.need.card';
  }
  if (value.slot === 'Q3') {
    if (!value.judgmentOptionId) return 'student.need.decide';
    if (!value.tradeOffId) return 'student.need.tradeOff';
    return value.reasonId ? null : 'student.need.whyCost';
  }
  if (value.slot === 'Q4') return isComplete(task, value) ? null : 'student.need.blanks';
  if (value.slot === 'Q5') return isComplete(task, value) ? null : 'student.need.starters';
  return null;
}

export function emptyDraft(task: StudentTaskDTO): DraftArtifact {
  const saved = task.draftArtifact;
  if (task.slot === 'Q2') return { slot: 'Q2', orderedCardIds: task.taskBody.cards.map((c) => c.cardId), ...saved } as DraftArtifact;
  if (task.slot === 'Q4') return { slot: 'Q4', placements: [], ...saved } as DraftArtifact;
  if (task.slot === 'Q5') return { slot: 'Q5', answers: [], ...saved } as DraftArtifact;
  return saved ?? { slot: task.slot };
}

/** What just changed, as researchers read it: option letters on Q1, IDs elsewhere, never the words a student types. */
export function describeChange(task: StudentTaskDTO, before: DraftArtifact, after: DraftArtifact): string[] {
  if (task.slot === 'Q1' && before.slot === 'Q1' && after.slot === 'Q1') {
    const letter = (items: { id: string }[], id: string) => letterOf(items.findIndex((item) => item.id === id));
    return [
      ...(after.answerId && after.answerId !== before.answerId ? [letter(task.answers, after.answerId)] : []),
      ...(after.evidenceId && after.evidenceId !== before.evidenceId ? [`Card ${letter(task.evidence, after.evidenceId)}`] : []),
    ];
  }
  if (before.slot === 'Q2' && after.slot === 'Q2') return [`order=${(after.orderedCardIds ?? []).join('>')}`];
  if (before.slot === 'Q3' && after.slot === 'Q3') {
    return [
      ...(after.judgmentOptionId !== before.judgmentOptionId ? [`path=${after.judgmentOptionId}`] : []),
      ...(after.tradeOffId && after.tradeOffId !== before.tradeOffId ? [`cost=${after.tradeOffId}`] : []),
      ...(after.reasonId && after.reasonId !== before.reasonId ? [`reason=${after.reasonId}`] : []),
    ];
  }
  if (before.slot === 'Q4' && after.slot === 'Q4') {
    const cardIn = (value: typeof after, slotId: string) => value.placements?.find((x) => x.slotId === slotId)?.cardId;
    const slots = [...new Set([...(before.placements ?? []), ...(after.placements ?? [])].map((x) => x.slotId))];
    return slots.filter((id) => cardIn(before, id) !== cardIn(after, id)).map((id) => `${id}=${cardIn(after, id) ?? 'empty'}`);
  }
  if (before.slot === 'Q5' && after.slot === 'Q5') {
    const answerTo = (value: typeof after, id: string) => value.answers?.find((a) => a.starterId === id);
    const ids = [...new Set([...(before.answers ?? []), ...(after.answers ?? [])].map((a) => a.starterId))];
    return ids
      .filter((id) => answerTo(before, id)?.text !== answerTo(after, id)?.text)
      .map((id) => (answerTo(after, id)?.declared ? `${id}=${answerTo(after, id)!.declared}` : id));
  }
  return [];
}

/** Compares answers, ignoring key order and array order where order means nothing. */
export const sameArtifact = (a: DraftArtifact, b: DraftArtifact): boolean => {
  const stable = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stable).sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([x], [y]) => x.localeCompare(y)).map(([k, v]) => [k, stable(v)]));
    return value;
  };
  if (a.slot === 'Q2' && b.slot === 'Q2') return JSON.stringify(a.orderedCardIds) === JSON.stringify(b.orderedCardIds);
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
};
