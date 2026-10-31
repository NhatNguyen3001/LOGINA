import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SourceReviewDTO, findRestrictedKeys } from '@logina/contracts';
import { harness, seedClarify, type Client, type Harness } from './helpers.js';

let h: Harness;
let a: Client;

const review = async (lessonId: string) => SourceReviewDTO.parse(await (await a.get(`/lessons/${lessonId}/source-review`)).json());

const analyzed = () => seedClarify(h, a);

const resolve = async (lessonId: string, issueId: string, body: object) => {
  const { version } = await review(lessonId);
  return a.post(`/lessons/${lessonId}/issues/${issueId}/resolve`, { baseVersion: version, ...body });
};

async function resolveBlockers(lessonId: string): Promise<void> {
  await resolve(lessonId, 'iss1', { action: 'KEEP_OPEN', keepOpenBounds: 'Shares only', keepOpenReason: 'No totals' });
  await resolve(lessonId, 'iss2', { action: 'USE_SUGGESTION', suggestionId: 'sug2' });
}

beforeAll(async () => {
  h = await harness();
  a = await h.client();
});

afterAll(async () => {
  await h.close();
});

describe('source review', () => {
  it('carries material paragraphs and issue spans that point into them', async () => {
    const lessonId = await analyzed();
    const body = await review(lessonId);
    expect(body.summaryClaims).toHaveLength(5);
    expect(body.issues).toHaveLength(4);
    const ids = body.material.paragraphs.map((p) => p.id);
    for (const span of body.issues.flatMap((i) => i.spans)) expect(ids).toContain(span.paragraphId);
  });

  it('seeded lesson source review has readByAI false and readBy SEEDED', async () => {
    const body = await review(await analyzed());
    expect(body.readByAI).toBe(false);
    expect(body.material.paragraphs.every((p) => p.readBy === 'SEEDED')).toBe(true);
  });

  it('source review carries materialVersionId and never storagePath', async () => {
    const lessonId = await analyzed();
    const raw = await (await a.get(`/lessons/${lessonId}/source-review`)).json();
    expect(findRestrictedKeys(raw, 'teacher')).toEqual([]);
    expect((raw as SourceReviewDTO).material.materialVersionId).toBeTruthy();
  });

  it('FE03 all blockers present in DTO even with more than three issues', async () => {
    const body = await review(await analyzed());
    expect(body.issues.filter((i) => i.severity === 'BLOCKER')).toHaveLength(2);
    expect(body.blockersRemaining).toBe(2);
    expect(body.approveReady).toBe(false);
  });

  it('another workspace gets 404', async () => {
    const lessonId = await analyzed();
    const b = await h.client();
    expect((await b.get(`/lessons/${lessonId}/source-review`)).status).toBe(404);
  });
});

describe('resolving issues', () => {
  it('KEEP_OPEN requires bounds and reason', async () => {
    const lessonId = await analyzed();
    expect((await resolve(lessonId, 'iss1', { action: 'KEEP_OPEN' })).status).toBe(400);
  });

  it('EDIT is saved as TEACHER_INTERPRETATION, not a source claim', async () => {
    const lessonId = await analyzed();
    await resolve(lessonId, 'iss1', { action: 'EDIT', text: 'My reading' });
    const issue = (await review(lessonId)).issues.find((i) => i.id === 'iss1');
    expect(issue).toMatchObject({ state: 'EDITED', resolution: { savedAs: 'TEACHER_INTERPRETATION', text: 'My reading' } });
    expect((await review(lessonId)).summaryClaims).toHaveLength(5);
  });

  it('resolved issue shows resolution, resolvedBy display name and resolvedAt', async () => {
    const lessonId = await analyzed();
    await resolve(lessonId, 'iss3', { action: 'CONFIRM' });
    const issue = (await review(lessonId)).issues.find((i) => i.id === 'iss3');
    expect(issue).toMatchObject({ state: 'CONFIRMED', resolvedBy: 'Ms. Lan', resolvedAt: expect.any(String) });
  });

  it('reopen creates a new issue version', async () => {
    const lessonId = await analyzed();
    await resolve(lessonId, 'iss3', { action: 'CONFIRM' });
    await resolve(lessonId, 'iss3', { action: 'REOPEN' });
    expect((await review(lessonId)).issues.find((i) => i.id === 'iss3')?.state).toBe('UNRESOLVED');
    const doc = (await h.live.db.doc(`lessons/${lessonId}/clarificationIssues/iss3`).get()).data();
    expect(doc?.version).toBe(2);
    expect((await h.live.db.collection(`lessons/${lessonId}/clarificationIssues/iss3/history`).get()).size).toBe(2);
  });

  it('resolve with a stale SourceReviewDTO.version is 409', async () => {
    const lessonId = await analyzed();
    const response = await a.post(`/lessons/${lessonId}/issues/iss3/resolve`, { action: 'CONFIRM', baseVersion: 99 });
    expect(response.status).toBe(409);
  });

  it('resolve without baseVersion is 400', async () => {
    const lessonId = await analyzed();
    expect((await a.post(`/lessons/${lessonId}/issues/iss3/resolve`, { action: 'CONFIRM' })).status).toBe(400);
  });

  it('an unknown issue is 404', async () => {
    const lessonId = await analyzed();
    expect((await resolve(lessonId, 'nope', { action: 'CONFIRM' })).status).toBe(404);
  });
});

describe('Source Approval 1', () => {
  const approve = async (lessonId: string) => {
    const { version } = await review(lessonId);
    return a.post(`/lessons/${lessonId}/source-approval`, { baseVersion: version });
  };

  it('VC06 approval blocked while an in-scope BLOCKER is unresolved', async () => {
    expect((await approve(await analyzed())).status).toBe(409);
  });

  it('VC05 excluded blocker leaves scope', async () => {
    const lessonId = await analyzed();
    await resolve(lessonId, 'iss1', { action: 'EXCLUDE', excludeReason: 'Out of scope' });
    await resolve(lessonId, 'iss2', { action: 'CONFIRM' });
    expect((await review(lessonId)).blockersRemaining).toBe(0);
    expect((await approve(lessonId)).status).toBe(200);
  });

  it('source approval returns SourceApprovalResultDTO, enqueues GENERATE and no generate route exists', async () => {
    const lessonId = await analyzed();
    await resolveBlockers(lessonId);
    const body = (await (await approve(lessonId)).json()) as { sourceModelVersionId: string; version: number; jobId: string };
    expect(body).toMatchObject({ version: 1, jobId: expect.any(String) });
    expect(h.enqueued).toContainEqual(expect.objectContaining({ jobId: body.jobId, type: 'GENERATE' }));
    expect((await a.post(`/lessons/${lessonId}/generate`)).status).toBe(404);
  });

  it('approval records the source model and moves the stage', async () => {
    const lessonId = await analyzed();
    await resolveBlockers(lessonId);
    const { sourceModelVersionId } = (await (await approve(lessonId)).json()) as { sourceModelVersionId: string };
    const lesson = (await h.live.db.doc(`lessons/${lessonId}`).get()).data();
    expect(lesson).toMatchObject({ stage: 'GENERATE_PREVIEW', currentSourceModelVersionId: sourceModelVersionId });
    const model = (await h.live.db.doc(`lessons/${lessonId}/sourceModelVersions/${sourceModelVersionId}`).get()).data();
    expect(model).toMatchObject({ status: 'APPROVED', version: 1, contentHash: expect.any(String) });
    expect(model?.openGaps).toHaveLength(1);
    expect(model?.excludedIds).toContain('iss4');
  });

  it('M08 approved source model contains no generatedEId', async () => {
    const lessonId = await analyzed();
    await resolveBlockers(lessonId);
    const { sourceModelVersionId } = (await (await approve(lessonId)).json()) as { sourceModelVersionId: string };
    const model = (await h.live.db.doc(`lessons/${lessonId}/sourceModelVersions/${sourceModelVersionId}`).get()).data();
    expect(JSON.stringify(model)).not.toMatch(/generatedE|"E[1-4]"/);
  });

  it('M01 claim without locator blocks approval', async () => {
    const lessonId = await analyzed();
    await resolveBlockers(lessonId);
    await h.live.db.doc(`lessons/${lessonId}/sourceEvidence/se1`).update({ locator: '' });
    expect((await approve(lessonId)).status).toBe(409);
  });

  it('F-L8 approval blocked while an in-scope figure has no altText', async () => {
    const lessonId = await analyzed();
    await resolveBlockers(lessonId);
    await h.live.db.doc(`lessons/${lessonId}/sourceUnits/table 8.1`).update({ 'figure.altText': '' });
    const response = await approve(lessonId);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'MISSING_ALT_TEXT', affectedRefs: ['table 8.1'] });
  });

  it('source-approval with a stale version is 409', async () => {
    const lessonId = await analyzed();
    await resolveBlockers(lessonId);
    expect((await a.post(`/lessons/${lessonId}/source-approval`, { baseVersion: 99 })).status).toBe(409);
  });
});
