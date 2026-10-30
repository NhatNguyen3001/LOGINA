import { createHash } from 'node:crypto';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/** Deterministic numbers in [0, 1) from a seed: the same seed always gives the same sequence. */
export function createPrng(seed: string): () => number {
  let counter = 0;
  return () => {
    counter += 1;
    return parseInt(sha256(`${seed}:${counter}`).slice(0, 13), 16) / 2 ** 52;
  };
}

/** Fisher-Yates, seeded with `contentManifestHash` so a release's order never depends on the run. */
export function shuffleForRelease<T>(seed: string, items: T[]): T[] {
  const random = createPrng(seed);
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

export function applyDisplayOrder<T extends { id: string }>(items: T[], displayOrder?: string[]): T[] | null {
  if (!displayOrder) return null;
  const byId = new Map(items.map((item) => [item.id, item]));
  const isPermutation =
    displayOrder.length === items.length &&
    new Set(displayOrder).size === items.length &&
    displayOrder.every((id) => byId.has(id));
  if (!isPermutation) throw new Error('applyDisplayOrder: displayOrder is not a permutation of the items');
  return displayOrder.map((id) => byId.get(id)!);
}

function order(ids: string[], contentManifestHash: string, displayOrder?: string[]): string[] {
  const applied = applyDisplayOrder(ids.map((id) => ({ id })), displayOrder);
  return applied ? applied.map((item) => item.id) : shuffleForRelease(contentManifestHash, ids);
}

const runtimeId = (prefix: string, releaseId: string, authoringId: string): string =>
  `${prefix}_${sha256(releaseId + authoringId).slice(0, 10)}`;

/** Opaque IDs in release order, so neither an ID nor a position gives away the correct option. */
export function assignRuntimeIds(
  releaseId: string,
  contentManifestHash: string,
  answers: { answerOptionId: string }[],
  evidence: { generatedEId: string }[],
  displayOrder?: { answers: string[]; evidence: string[] },
): {
  answers: { runtimeId: string; answerOptionId: string }[];
  evidence: { runtimeId: string; generatedEId: string }[];
} {
  return {
    answers: order(answers.map((a) => a.answerOptionId), contentManifestHash, displayOrder?.answers).map(
      (answerOptionId) => ({ runtimeId: runtimeId('opt', releaseId, answerOptionId), answerOptionId }),
    ),
    evidence: order(evidence.map((e) => e.generatedEId), contentManifestHash, displayOrder?.evidence).map(
      (generatedEId) => ({ runtimeId: runtimeId('ev', releaseId, generatedEId), generatedEId }),
    ),
  };
}
