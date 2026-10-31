import {
  ApproveResultDTO,
  AssignResultDTO,
  AssignmentListDTO,
  RecordedRunsDTO,
  AttemptDTO,
  ChallengeListDTO,
  ClassDTO,
  ClassTrackingDTO,
  ConsentResultDTO,
  DemoSnapshotsDTO,
  EditResultDTO,
  JobDTO,
  LessonDTO,
  LessonListDTO,
  MaterialViewUrlDTO,
  MeDTO,
  SourceApprovalResultDTO,
  SourceDraftDTO,
  SourceReviewDTO,
  StudentChallengeDTO,
  StudentFeedbackDTO,
  StudentTaskDTO,
  SubmitResultDTO,
  TaskApprovalDTO,
  TasksOverviewDTO,
  TeacherLogicReviewDTO,
  TeacherTaskPreviewDTO,
  TeacherTaskSummaryDTO,
  TraceDTO,
  TryCaseDTO,
  UploadUrlDTO,
  type CreateLessonReq,
  type DispositionReq,
  type EditReq,
  type JobAnswerReq,
  type LockReq,
  type RateLimitDTO,
  type RegisterMaterialReq,
  type ResolveIssueReq,
  type Slot,
  type SubmitReq,
  type UpdateMeReq,
  type UploadUrlReq,
} from '@logina/contracts';
import { z } from 'zod';
import { ensureSession, idToken, renewSession } from './auth';
import { setBusy } from './busy';

export const newKey = (): string => crypto.randomUUID();

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message = code,
    readonly affectedRefs?: string[],
    readonly detail?: unknown,
    readonly rateLimit?: RateLimitDTO,
  ) {
    super(message);
  }
}

const Ok = z.object({ ok: z.literal(true) });
const Registered = z.object({ materialVersionId: z.string(), aiMode: z.enum(['SEEDED', 'LIVE']) });

interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  body?: unknown;
  key?: string;
}

async function send(path: string, { method, body, key }: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Authorization: `Bearer ${await idToken()}` };
  if (method !== 'GET') headers['Content-Type'] = 'application/json';
  if (key) headers['Idempotency-Key'] = key;
  return fetch(`/api/v1${path}`, { method, headers, ...(method === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }) });
}

async function toError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => ({}))) as { code?: string; message?: string; affectedRefs?: string[]; detail?: unknown };
  const rateLimit = body.code === 'RATE_LIMITED' ? (body as unknown as RateLimitDTO) : undefined;
  return new ApiError(response.status, body.code ?? 'INTERNAL', body.message, body.affectedRefs, body.detail, rateLimit);
}

const TEACHER_BUSY_RETRIES = 3;
const MS_PER_SECOND = 1000;
const STUDENT_CALL = /^\/(me\/assignments|assignments\/[^/]+\/attempts|attempts\/[^/]+\/(tasks|feedback))/;

const isBusy = ({ rateLimit }: ApiError): boolean => rateLimit?.action === 'API' || rateLimit?.action === 'SESSION';
const wait = (seconds: number) => new Promise((resolve) => setTimeout(resolve, seconds * MS_PER_SECOND));

/** A student never loses an answer to a busy server, so their calls retry without a cap. */
async function sendPatiently(path: string, options: RequestOptions): Promise<Response> {
  const unlimited = STUDENT_CALL.test(path);
  for (let retries = 0; ; retries += 1) {
    const response = await send(path, options);
    if (response.status !== 429) {
      setBusy(false);
      return response;
    }
    const error = await toError(response.clone());
    if (!isBusy(error) || (!unlimited && retries >= TEACHER_BUSY_RETRIES)) {
      setBusy(false);
      return response;
    }
    setBusy(true);
    await wait(error.rateLimit?.retryAfterSeconds ?? 1);
  }
}

export async function request<S extends z.ZodType>(path: string, schema: S, options: RequestOptions): Promise<z.infer<S>> {
  await ensureSession();
  let response = await sendPatiently(path, options);
  if (response.status === 401) {
    await renewSession();
    response = await sendPatiently(path, options);
  }
  if (!response.ok) throw await toError(response);
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) throw new ApiError(response.status, 'RESPONSE_SCHEMA');
  return parsed.data;
}

const get = <S extends z.ZodType>(path: string, schema: S) => request(path, schema, { method: 'GET' });
const post = <S extends z.ZodType>(path: string, schema: S, body: unknown, key: string) => request(path, schema, { method: 'POST', body, key });

const lessonPath = (id: string) => `/lessons/${id}`;
const taskPath = (id: string, slot: Slot) => `/lessons/${id}/tasks/${slot}`;
const attemptTask = (id: string, slot: Slot) => `/attempts/${id}/tasks/${slot}`;

export const getMe = () => get('/me', MeDTO);
export const updateMe = (req: UpdateMeReq) => request('/me', MeDTO, { method: 'PATCH', body: req, key: newKey() });
export const sendConsent = (req: { consentVersion: string; choice: 'AGREED' | 'DECLINED' }, key: string) => post('/me/consent', ConsentResultDTO, req, key);

export const getLessons = () => get('/lessons', LessonListDTO);
export const getLesson = (id: string) => get(lessonPath(id), LessonDTO);
export const createLesson = (req: CreateLessonReq, key: string) => post('/lessons', LessonDTO, req, key);
export const getClass = (id: string) => get(`/classes/${id}`, ClassDTO);

export const getUploadUrl = (lessonId: string, req: UploadUrlReq, key: string) => post(`${lessonPath(lessonId)}/materials/upload-url`, UploadUrlDTO, req, key);
export const registerMaterial = (lessonId: string, req: RegisterMaterialReq, key: string) => post(`${lessonPath(lessonId)}/materials`, Registered, req, key);
export const getMaterialViewUrl = (lessonId: string, materialId: string) => get(`${lessonPath(lessonId)}/materials/${materialId}/view-url`, MaterialViewUrlDTO);
export const startAnalyze = (lessonId: string, key: string) => post(`${lessonPath(lessonId)}/analyze`, JobDTO, {}, key);

export const getJob = (id: string) => get(`/jobs/${id}`, JobDTO);
export const cancelJob = (id: string, key: string) => post(`/jobs/${id}/cancel`, JobDTO, {}, key);
export const answerJob = (id: string, req: JobAnswerReq, key: string) => post(`/jobs/${id}/answer`, JobDTO, req, key);

export const getSourceReview = (id: string) => get(`${lessonPath(id)}/source-review`, SourceReviewDTO);
export const resolveIssue = (id: string, issueId: string, req: ResolveIssueReq, key: string) => post(`${lessonPath(id)}/issues/${issueId}/resolve`, Ok, req, key);
export const approveSource = (id: string, baseVersion: number, key: string) => post(`${lessonPath(id)}/source-approval`, SourceApprovalResultDTO, { baseVersion }, key);
export const getSourceDraft = (id: string) => get(`${lessonPath(id)}/source-draft`, SourceDraftDTO);

export const getTasks = (id: string) => get(`${lessonPath(id)}/tasks`, TasksOverviewDTO);
export const getPreview = (id: string, slot: Slot) => get(`${taskPath(id, slot)}/preview`, slot === 'Q1' ? TeacherTaskPreviewDTO : TeacherTaskSummaryDTO);
export const getLogicReview = (id: string, slot: Slot) => get(`${taskPath(id, slot)}/logic-review`, TeacherLogicReviewDTO);
export const getChallenges = (id: string, slot: Slot) => get(`${taskPath(id, slot)}/challenges`, ChallengeListDTO);
export const tryCase = (id: string, slot: Slot, req: { answerId: string; evidenceId: string }, key: string) => post(`${taskPath(id, slot)}/try-case`, TryCaseDTO, req, key);
export const chooseSufficiency = (id: string, slot: Slot, req: { choice: string; baseVersion: number }, key: string) => post(`${taskPath(id, slot)}/sufficiency-choice`, JobDTO, req, key);
export const sendEdit = (id: string, req: EditReq, key: string) => post(`${lessonPath(id)}/edits`, EditResultDTO, req, key);
export const rerunTask = (id: string, slot: Slot, key: string) => post(`${taskPath(id, slot)}/rerun`, JobDTO, {}, key);
export const sendDisposition = (id: string, slot: Slot, req: DispositionReq, key: string) => post(`${taskPath(id, slot)}/dispositions`, Ok, req, key);
export const getApproval = (id: string) => get(`${lessonPath(id)}/approval`, TaskApprovalDTO);
export const approveTask = (id: string, slot: Slot, req: { expectedDraftVersion: number; previewHash: string; candidateSetVersion: number; confirmed: true }, key: string) =>
  post(`${taskPath(id, slot)}/approve`, ApproveResultDTO, req, key);
export const assignLesson = (id: string, req: { classId: string; baseVersion: number; dueAt?: string; messageToStudents?: string }, key: string) => post(`${lessonPath(id)}/assignments`, AssignResultDTO, req, key);

export const getTracking = (assignmentId: string) => get(`/assignments/${assignmentId}/tracking`, ClassTrackingDTO);
export const getTrace = (attemptId: string, slot: Slot) => get(`/attempts/${attemptId}/trace/${slot}`, TraceDTO);

export const getMyAssignments = () => get('/me/assignments', AssignmentListDTO);
export const getRecordedRuns = () => get('/me/assignments/runs', RecordedRunsDTO);
export const startAttempt = (assignmentId: string, key: string) => post(`/assignments/${assignmentId}/attempts`, AttemptDTO, {}, key);
export const resetAttempt = (attemptId: string, key: string) => post(`/attempts/${attemptId}/reset`, AttemptDTO, {}, key);
export const restartAttempt = (assignmentId: string, key: string) => post(`/assignments/${assignmentId}/attempts/restart`, AttemptDTO, {}, key);
export const getStudentTask = (attemptId: string, slot: Slot) => get(attemptTask(attemptId, slot), StudentTaskDTO);
export const saveDraft = (attemptId: string, slot: Slot, body: unknown) => request(`${attemptTask(attemptId, slot)}/draft`, Ok, { method: 'PUT', body, key: newKey() });
export const lockTask = (attemptId: string, slot: Slot, req: LockReq, key: string) => post(`${attemptTask(attemptId, slot)}/lock`, StudentChallengeDTO, req, key);
export const getChallenge = (attemptId: string, slot: Slot) => get(`${attemptTask(attemptId, slot)}/challenge`, StudentChallengeDTO);
export const submitTask = (attemptId: string, slot: Slot, req: SubmitReq, key: string) => post(`${attemptTask(attemptId, slot)}/submit`, SubmitResultDTO, req, key);
export const getFeedback = (attemptId: string) => get(`/attempts/${attemptId}/feedback`, z.array(StudentFeedbackDTO));

export const demoReset = (key: string) => post('/demo/reset', Ok, {}, key);
export const demoSimulate = (assignmentId: string, key: string) => post('/demo/simulate-class', Ok, { assignmentId }, key);
export const demoFailNextRerun = (key: string) => post('/demo/fail-next-rerun', Ok, {}, key);
export const getDemoSnapshots = () => get('/demo/snapshots', DemoSnapshotsDTO);
export const restoreSnapshot = (stepId: string, key: string) => post(`/demo/snapshots/${stepId}/restore`, Ok, {}, key);
