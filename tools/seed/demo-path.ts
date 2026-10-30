import { loadFixture } from '@logina/domain';

/** App-Flow section 6 through the real API. Nothing here writes a lesson state or an approval directly. */

export type Locale = 'en' | 'vi';
export type StepId = 't07' | 't12' | 's01' | 't14';

export const STEP_LABELS: Record<StepId, Record<Locale, string>> = {
  t07: { en: 'T7 · Matching Preview', vi: 'T7 · Xem trước ghép cặp' },
  t12: { en: 'T12 · Task Approval', vi: 'T12 · Duyệt bài' },
  s01: { en: 'S1 · Student starts', vi: 'S1 · Học sinh bắt đầu' },
  t14: { en: 'T14 · After the class has worked', vi: 'T14 · Sau khi cả lớp làm' },
};

export interface DemoApi {
  workspace: { classId: string };
  get: (path: string) => Promise<Response>;
  post: (path: string, body?: unknown) => Promise<Response>;
}

interface ApprovalTask {
  slot: string;
  draftVersion: number;
  previewHash: string;
  candidateSetVersion: number;
}

interface Edit {
  id: string;
  payload: object;
}

const SLOTS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'] as const;

const LESSON = {
  en: { title: 'Lesson 8: Labor and employment', subject: 'Geography', topic: 'Labor and employment' },
  vi: { title: 'Bài 8: Lao động và việc làm', subject: 'Địa lí', topic: 'Lao động và việc làm' },
};

const REASONS = {
  en: { bounds: 'Shares only', keepOpen: 'The table gives no totals', accept: 'Fits this class' },
  vi: { bounds: 'Chỉ nói về tỉ trọng', keepOpen: 'Bảng không có tổng số', accept: 'Phù hợp với lớp này' },
};

/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- each call site reads its own DTO */
async function expectOk(response: Promise<Response>, what: string): Promise<any> {
  const result = await response;
  if (!result.ok) throw new Error(`${what} failed with ${result.status}: ${await result.text()}`);
  return result.json();
}

const scriptedEdit = (locale: Locale, id: string): Edit => (loadFixture('scripted-edits', locale) as Edit[]).find((e) => e.id === id)!;

const approvalTasks = async (api: DemoApi, lessonId: string): Promise<ApprovalTask[]> =>
  (await expectOk(api.get(`/lessons/${lessonId}/approval`), 'Read approval')).tasks as ApprovalTask[];

const lessonVersion = async (api: DemoApi, lessonId: string): Promise<number> =>
  (await expectOk(api.get(`/lessons/${lessonId}`), 'Read lesson')).version as number;

const draftTarget = async (api: DemoApi, lessonId: string, slot: string): Promise<{ targetId: string; baseVersion: number }> => {
  const lesson = await expectOk(api.get(`/lessons/${lessonId}`), 'Read lesson');
  const { draftVersion } = (await approvalTasks(api, lessonId)).find((t) => t.slot === slot)!;
  return { targetId: lesson.currentTaskDraftIds[slot] as string, baseVersion: draftVersion };
};

/** T12 onward: the Q4 fix, the QG1 acceptance, five approvals and Assign. */
export async function finishApproval(api: DemoApi, lessonId: string, locale: Locale): Promise<{ assignmentId: string }> {
  const base = `/lessons/${lessonId}`;
  await expectOk(
    api.post(`${base}/edits`, { editScope: 'LOGIC', targetType: 'challenge', ...(await draftTarget(api, lessonId, 'Q4')), changedRefs: ['TN2'], payload: scriptedEdit(locale, 'q4-tn2-fix').payload }),
    'Fix TN2',
  );

  const q1 = (await approvalTasks(api, lessonId)).find((t) => t.slot === 'Q1')!;
  await expectOk(
    api.post(`${base}/tasks/Q1/dispositions`, { gateId: 'QG1', findingCode: 'TREND_SPOTTING_ONLY', decision: 'TEACHER_ACCEPT_WITH_REASON', reason: REASONS[locale].accept, baseVersion: q1.draftVersion }),
    'Accept QG1',
  );

  for (const { slot, draftVersion, previewHash, candidateSetVersion } of await approvalTasks(api, lessonId)) {
    await expectOk(api.post(`${base}/tasks/${slot}/approve`, { expectedDraftVersion: draftVersion, previewHash, candidateSetVersion, confirmed: true }), `Approve ${slot}`);
  }
  return expectOk(api.post(`${base}/assignments`, { classId: api.workspace.classId, baseVersion: await lessonVersion(api, lessonId) }), 'Assign');
}

/** The eighth student: no research consent, so no research row. */
async function takeAssignment(api: DemoApi, assignmentId: string, locale: Locale): Promise<void> {
  const { attemptId } = await expectOk(api.post(`/assignments/${assignmentId}/attempts`), 'Start attempt');
  const [script] = loadFixture('simulate-class', locale) as { tasks: { slot: string; initial: object }[] }[];
  for (const slot of SLOTS) {
    const task = await expectOk(api.get(`/attempts/${attemptId}/tasks/${slot}`), `Read ${slot}`);
    const artifact = slot === 'Q1'
      ? { slot, answerId: task.answers[0].id, evidenceId: task.evidence[0].id }
      : { ...script!.tasks.find((t) => t.slot === slot)!.initial, slot };
    await expectOk(api.post(`/attempts/${attemptId}/tasks/${slot}/lock`, { artifact, initialConfidence: 60 }), `Lock ${slot}`);
    await expectOk(api.post(`/attempts/${attemptId}/tasks/${slot}/submit`, { choice: 'KEEP', finalArtifact: artifact, finalConfidence: 70 }), `Submit ${slot}`);
  }
}

export async function runDemoPath(api: DemoApi, locale: Locale, capture: (step: StepId) => Promise<void>): Promise<{ lessonId: string; assignmentId: string }> {
  const source = loadFixture('source', locale) as { intent: { objective: string } };
  const lesson = await expectOk(
    api.post('/lessons', { ...LESSON[locale], level: 'basic', primaryClassId: api.workspace.classId, objective: source.intent.objective, contentLocale: locale }),
    'Create lesson',
  );
  const lessonId = lesson.id as string;
  const base = `/lessons/${lessonId}`;

  await expectOk(api.post(`${base}/materials`, { sample: true }), 'Attach sample');
  await expectOk(api.post(`${base}/analyze`), 'Analyze');

  const reviewVersion = async () => (await expectOk(api.get(`${base}/source-review`), 'Read source review')).version as number;
  const resolve = async (issueId: string, body: object) =>
    expectOk(api.post(`${base}/issues/${issueId}/resolve`, { ...body, baseVersion: await reviewVersion() }), `Resolve ${issueId}`);
  await resolve('iss1', { action: 'KEEP_OPEN', keepOpenBounds: REASONS[locale].bounds, keepOpenReason: REASONS[locale].keepOpen });
  await resolve('iss2', { action: 'USE_SUGGESTION', suggestionId: 'sug2' });
  await resolve('iss3', { action: 'CONFIRM' });
  await expectOk(api.post(`${base}/source-approval`, { baseVersion: await reviewVersion() }), 'Approval 1');

  await expectOk(api.post(`${base}/tasks/Q4/sufficiency-choice`, { choice: 'REFOCUS', baseVersion: await lessonVersion(api, lessonId) }), 'Sufficiency choice');
  await capture('t07');

  await expectOk(
    api.post(`${base}/edits`, { editScope: 'CONTENT', targetType: 'answerOption', ...(await draftTarget(api, lessonId, 'Q1')), changedRefs: ['A4'], payload: scriptedEdit(locale, 'q1-a4-reword').payload }),
    'Reword A4',
  );
  await capture('t12');

  const { assignmentId } = await finishApproval(api, lessonId, locale);
  await capture('s01');

  await expectOk(api.post('/demo/simulate-class', { assignmentId }), 'Simulate class');
  await takeAssignment(api, assignmentId, locale);
  await capture('t14');

  return { lessonId, assignmentId };
}
