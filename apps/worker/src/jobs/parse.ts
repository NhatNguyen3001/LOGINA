import { FieldValue } from 'firebase-admin/firestore';
import { checkQuotes, toSourceUnits, type IssuesFixture, type SourceFixture } from '@logina/domain';
import { encodeNested } from '@logina/db';
import { generateStructured, modelFor } from '../ai/model.js';
import { AnalyzerOutput, ReaderOutput } from '../ai/schemas.js';
import { JobFailure, JobPaused } from '../errors.js';
import { docxToText } from '../live/docx.js';
import type { JobContext } from '../worker.js';

const MIN_CHARACTERS = 100;
const MIN_CLAIMS = 3;
const MAX_WORDS = 6000;
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const NOT_LOCATED = {
  en: 'AI could not locate this in the source',
  vi: 'AI không tìm thấy đoạn này trong nguồn',
};

type Locale = 'en' | 'vi';

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Doc IDs can't hold every locator as is, but `pN-K` and `table 8.1` are both safe. */
const writeAll = async (context: JobContext, collection: string, docs: ({ id: string } & object)[]): Promise<void> => {
  const { db } = context.deps;
  const batch = db.batch();
  for (const { id, ...doc } of docs) batch.set(db.doc(`lessons/${context.lesson.id}/${collection}/${id}`), encodeNested(doc));
  await batch.commit();
};

async function seededParse(context: JobContext): Promise<void> {
  const { deps, lesson } = context;
  const locale = lesson.contentLocale as Locale;
  const source = deps.loadFixture('source', locale) as SourceFixture;
  const materialVersionId = lesson.currentMaterialVersionId as string;

  await context.step('read', async () => {
    await delay(deps.config.stepDelayMs);
    await writeAll(context, 'sourceUnits', source.units.map((unit) => ({ ...unit, materialVersionId, readBy: 'SEEDED' })));
    await deps.db.doc(`lessons/${lesson.id}/materialVersions/${materialVersionId}`).update({ parseStatus: 'DONE' });
  });
  await context.step('claims', async () => {
    await delay(deps.config.stepDelayMs);
    await writeAll(context, 'sourceEvidence', source.evidence.map((e) => ({ ...e, materialVersionId, verificationStatus: 'VERIFIED' })));
    await writeAll(context, 'sourceClaims', source.claims);
    await writeAll(context, 'claimEvidenceRelations', source.relations);
    await deps.db.doc(`lessons/${lesson.id}/teacherIntentVersions/${lesson.currentIntentVersionId as string}`).set(source.intent, { merge: true });
  });
  await context.step('issues', async () => {
    await delay(deps.config.stepDelayMs);
    const issues = deps.loadFixture('issues', locale) as IssuesFixture;
    await writeAll(context, 'clarificationIssues', issues.map((issue) => ({ ...issue, version: 1 })));
  });
  await context.step('questions', async () => {
    await delay(deps.config.stepDelayMs);
    await deps.db.doc(`lessons/${lesson.id}`).update({ stage: 'CLARIFY', updatedAt: FieldValue.serverTimestamp() });
  });
}

async function liveRead(context: JobContext, material: FirebaseFirestore.DocumentData): Promise<void> {
  const { deps, lesson } = context;
  const { config, genai, bucket, db } = deps;
  const materialVersionId = lesson.currentMaterialVersionId as string;
  const materialRef = db.doc(`lessons/${lesson.id}/materialVersions/${materialVersionId}`);
  const storagePath = material.storagePath as string;
  const unitKind = material.mimeType === DOCX ? 'SECTION' : 'PAGE';

  const refuse = async (code: 'TOO_MANY_PAGES' | 'UNREADABLE' | 'UNSUPPORTED_LANGUAGE', detail?: Record<string, unknown>): Promise<never> => {
    await materialRef.update({ parseStatus: 'FAILED', refusal: { code, ...(detail ? { detail } : {}) } });
    throw new JobFailure(code, detail);
  };

  let text: string | undefined;
  if (material.mimeType === DOCX) {
    const converted = await docxToText((await bucket.file(storagePath).download())[0]).catch(() => null);
    if (!converted) return refuse('UNREADABLE');
    if (converted.wordCount > MAX_WORDS) return refuse('TOO_MANY_PAGES', { wordCount: converted.wordCount, limit: MAX_WORDS });
    text = converted.text;
  }

  const reading = await generateStructured(genai, config, {
    role: 'reader',
    schema: ReaderOutput,
    ...(text
      ? { text }
      : { files: [{ gcsUri: `gs://${config.materialsBucket}/${storagePath}`, mimeType: material.mimeType as string }] }),
  });

  const characters = reading.pages.flatMap((p) => p.paragraphs).reduce((sum, p) => sum + p.text.length, 0);
  if (characters < MIN_CHARACTERS) return refuse('UNREADABLE');
  if (reading.language === 'other') return refuse('UNSUPPORTED_LANGUAGE');

  await writeAll(context, 'sourceUnits', toSourceUnits(materialVersionId, reading));
  await materialRef.update({
    parseStatus: 'DONE',
    detectedLocale: reading.language,
    readerVersion: modelFor('reader', config),
    pageCount: reading.pages.length,
    unitKind,
  });

  if (reading.language !== lesson.contentLocale) {
    await db.doc(`jobs/${context.jobId}`).update({
      status: 'NEEDS_INPUT',
      question: { kind: 'LANGUAGE_MISMATCH', detected: reading.language, chosen: lesson.contentLocale },
    });
    throw new JobPaused();
  }
}

async function liveAnalyze(context: JobContext, locale: Locale): Promise<void> {
  const { deps, lesson } = context;
  const { db, genai, config } = deps;
  const materialVersionId = lesson.currentMaterialVersionId as string;
  const units = (await db.collection(`lessons/${lesson.id}/sourceUnits`).get()).docs.map((doc) => ({
    locator: doc.id,
    text: doc.data().text as string,
  }));

  const analysis = await generateStructured(genai, config, {
    role: 'analyzer',
    schema: AnalyzerOutput,
    variables: { locale },
    text: units.map((unit) => `[${unit.locator}] ${unit.text}`).join('\n'),
  });

  const located = analysis.claims.map((claim) => ({ claim, ...checkQuotes(units, claim.evidence) }));
  const verified = located.filter(({ kept }) => kept.length > 0);
  if (verified.length < MIN_CLAIMS) {
    await db.doc(`lessons/${lesson.id}/materialVersions/${materialVersionId}`).update({ refusal: { code: 'TOO_LITTLE_CONTENT' } });
    throw new JobFailure('TOO_LITTLE_CONTENT');
  }

  const evidence = verified.flatMap(({ claim, kept }) =>
    kept.map((quote, i) => ({
      id: `se_${claim.id}_${i}`,
      sourceUnitId: quote.locator,
      text: quote.quote,
      locator: quote.locator,
      materialVersionId,
      verificationStatus: 'VERIFIED',
    })),
  );
  await writeAll(context, 'sourceEvidence', evidence);
  await writeAll(
    context,
    'sourceClaims',
    verified.map(({ claim, kept }) => ({
      id: claim.id,
      wording: claim.wording,
      sourceEvidenceIds: kept.map((_, i) => `se_${claim.id}_${i}`),
      acceptedStatus: 'VERIFIED',
    })),
  );

  const notLocated = located
    .filter(({ kept }) => kept.length === 0)
    .map(({ claim }) => ({
      issueType: 'MISSING' as const,
      severity: 'BLOCKER' as const,
      bubble: `${NOT_LOCATED[locale]}: ${claim.wording}`,
      locators: [],
      suggestions: [],
    }));
  const issues = [...analysis.issues, ...notLocated].map((issue, i) => ({
    id: `iss${i + 1}`,
    pointNumber: i + 1,
    spans: issue.locators.map((paragraphId) => ({ paragraphId, start: 0, end: units.find((u) => u.locator === paragraphId)?.text.length ?? 0 })),
    issueType: issue.issueType,
    questionKind: 'SOURCE',
    severity: issue.severity,
    sourceRef: issue.locators[0] ?? '',
    bubble: issue.bubble,
    currentInterpretation: '',
    suggestions: issue.suggestions.map((text, j) => ({ id: `sug${i + 1}_${j}`, text, sourceRef: issue.locators[0] ?? '', rationale: '' })),
    state: 'UNRESOLVED',
    version: 1,
  }));
  await writeAll(context, 'clarificationIssues', issues);
  await db.doc(`lessons/${lesson.id}`).update({
    stage: issues.length > 0 ? 'CLARIFY' : 'SOURCE_REVIEW',
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/** PARSE then ANALYZE, as one job with T2's four steps. */
export async function runParse(context: JobContext): Promise<void> {
  if (context.mode === 'SEEDED') return seededParse(context);

  const { deps, lesson, job } = context;
  const materialRef = deps.db.doc(`lessons/${lesson.id}/materialVersions/${lesson.currentMaterialVersionId as string}`);
  const material = (await materialRef.get()).data()!;

  if (!job.answer) await context.step('read', () => liveRead(context, material));
  const current = (await deps.db.doc(`lessons/${lesson.id}`).get()).data()!;
  await context.step('claims', () => liveAnalyze(context, current.contentLocale as Locale));
}
