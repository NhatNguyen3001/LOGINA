import { closestCenter, DndContext, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Artifact, DraftArtifact, Q2TaskBody, Q3TaskBody, Q4TaskBody, Q5TaskBody, StudentTaskDTO } from '@logina/contracts';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Pick } from '@/components/logina/Pick';

type Draft<S extends Artifact['slot']> = Extract<DraftArtifact, { slot: S }>;

interface EditorProps<S extends Artifact['slot'], B> {
  body: B;
  value: Draft<S>;
  onChange: (next: Draft<S>) => void;
  original?: Extract<Artifact, { slot: S }> | undefined;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export const letterOf = (index: number): string => LETTERS[index] ?? String(index + 1);

const pickState = (id: string, chosen: string | undefined, original: string | undefined) => {
  if (original === undefined) return 'default' as const;
  if (id === original) return 'orig' as const;
  return id === chosen ? ('new' as const) : ('default' as const);
};

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
          <Pick key={id} name="evidence" value={id} label={t('student.answer.cardLabel', { n: index + 1 })} checked={value.evidenceId === id} state={pickState(id, value.evidenceId, original?.evidenceId)} onSelect={(evidenceId) => onChange({ ...value, evidenceId })}>
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
    <li ref={setNodeRef} style={style} className={`opt rank ${isDragging ? 'dragging' : ''}`} {...listeners}>
      <GripVertical className="ico grip" aria-hidden="true" />
      <span className="k">{index + 1}</span>
      <span>{text}</span>
      {/* The row starts a drag, so the buttons keep their own presses. */}
      <span className="acts" onMouseDown={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()}>
        <button type="button" className="ibtn" aria-label={t('student.q2.moveUp', { card: text })} disabled={index === 0} onClick={() => onMove(-1)}>
          <ArrowUp className="ico" aria-hidden="true" />
        </button>
        <button type="button" className="ibtn" aria-label={t('student.q2.moveDown', { card: text })} disabled={index === count - 1} onClick={() => onMove(1)}>
          <ArrowDown className="ico" aria-hidden="true" />
        </button>
      </span>
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

export function Q3Editor({ body, value, onChange }: EditorProps<'Q3', Q3TaskBody>) {
  const { t } = useTranslation();
  const comparisons = value.comparisons ?? [];
  const tradeOffIds = value.tradeOffIds ?? [];

  const compare = (criterionId: string, option: string) =>
    onChange({ ...value, comparisons: [...comparisons.filter((c) => c.criterionId !== criterionId), { criterionId, value: option }] });

  const toggle = (id: string) =>
    onChange({ ...value, tradeOffIds: tradeOffIds.includes(id) ? tradeOffIds.filter((x) => x !== id) : [...tradeOffIds, id] });

  return (
    <>
      <h2 className="s15 b">{t('student.q3.compare')}</h2>
      {body.criteria.map(({ criterionId, text }) => (
        <fieldset key={criterionId} className="stack">
          <legend className="b">{text}</legend>
          {body.options.map(({ optionId, text: option }) => (
            <Pick key={optionId} name={criterionId} value={optionId} checked={comparisons.find((c) => c.criterionId === criterionId)?.value === optionId} onSelect={(picked) => compare(criterionId, picked)}>
              {option}
            </Pick>
          ))}
        </fieldset>
      ))}
      <h2 className="s15 b">{t('student.q3.decide')}</h2>
      <div className="stack" role="radiogroup" aria-label={t('student.q3.decide')}>
        {body.options.map(({ optionId, text }) => (
          <Pick key={optionId} name="judgment" value={optionId} checked={value.judgmentOptionId === optionId} onSelect={(judgmentOptionId) => onChange({ ...value, judgmentOptionId })}>
            {text}
          </Pick>
        ))}
      </div>
      <h2 className="s15 b">{t('student.q3.tradeOffs')}</h2>
      <div className="stack">
        {body.constraints.map(({ tradeOffId, text }) => (
          <label key={tradeOffId} className="pick">
            <input type="checkbox" checked={tradeOffIds.includes(tradeOffId)} onChange={() => toggle(tradeOffId)} />
            <span className="grow">{text}</span>
          </label>
        ))}
      </div>
    </>
  );
}

export function Q4Editor({ body, value, onChange }: EditorProps<'Q4', Q4TaskBody>) {
  const { t } = useTranslation();
  const template = body.templates.find((x) => x.templateId === value.templateId);
  const slots = value.slots ?? [];

  const fill = (slotId: string, choiceId: string) => onChange({ ...value, slots: [...slots.filter((s) => s.slotId !== slotId), { slotId, choiceId }] });

  return (
    <>
      <h2 className="s15 b">{t('student.q4.template')}</h2>
      <div className="stack" role="radiogroup" aria-label={t('student.q4.template')}>
        {body.templates.map(({ templateId, text }) => (
          <Pick key={templateId} name="template" value={templateId} checked={value.templateId === templateId} onSelect={(id) => onChange({ slot: 'Q4', templateId: id, slots: [] })}>
            {text}
          </Pick>
        ))}
      </div>
      {template?.slots.map(({ slotId, choices }, index) => (
        <div key={slotId} className="field">
          <label htmlFor={slotId}>{t('student.q4.blank', { n: index + 1 })}</label>
          <select id={slotId} className="select" value={slots.find((s) => s.slotId === slotId)?.choiceId ?? ''} onChange={(event) => fill(slotId, event.target.value)}>
            <option value="" disabled>{t('student.q4.choose')}</option>
            {choices.map(({ choiceId, text }) => (
              <option key={choiceId} value={choiceId}>{text}</option>
            ))}
          </select>
        </div>
      ))}
    </>
  );
}

function CountedField({ id, label, value, max, onChange }: { id: string; label: string; value: string; max: number; onChange: (next: string) => void }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} className="textarea" maxLength={max} value={value} onChange={(event) => onChange(event.target.value)} />
      <span className="hint num">{`${value.length}/${max}`}</span>
    </div>
  );
}

export function Q5Editor({ body, value, onChange }: EditorProps<'Q5', Q5TaskBody>) {
  const { t } = useTranslation();
  const max = body.maxCharsPerField;
  return (
    <>
      <p className="s15 sec">{body.instructions}</p>
      <CountedField id="proposal" label={t('student.q5.proposal')} value={value.proposal ?? ''} max={max} onChange={(proposal) => onChange({ ...value, proposal })} />
      <CountedField id="reason" label={t('student.q5.reason')} value={value.reason ?? ''} max={max} onChange={(reason) => onChange({ ...value, reason })} />
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
  if (value.slot === 'Q3' && task.slot === 'Q3') return Boolean(value.judgmentOptionId) && task.taskBody.criteria.every((c) => value.comparisons?.some((x) => x.criterionId === c.criterionId));
  if (value.slot === 'Q4' && task.slot === 'Q4') {
    const template = task.taskBody.templates.find((x) => x.templateId === value.templateId);
    return Boolean(template) && template!.slots.every((s) => value.slots?.some((x) => x.slotId === s.slotId));
  }
  if (value.slot === 'Q5') return Boolean(value.proposal?.trim() && value.reason?.trim());
  return false;
}

/** Lists the request requires start empty, so a student who ticks no drawback can still lock. */
export function emptyDraft(task: StudentTaskDTO): DraftArtifact {
  const saved = task.draftArtifact;
  if (task.slot === 'Q2') return { slot: 'Q2', orderedCardIds: task.taskBody.cards.map((c) => c.cardId), ...saved } as DraftArtifact;
  if (task.slot === 'Q3') return { slot: 'Q3', comparisons: [], tradeOffIds: [], ...saved } as DraftArtifact;
  if (task.slot === 'Q4') return { slot: 'Q4', slots: [], ...saved } as DraftArtifact;
  return saved ?? { slot: task.slot };
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
