/** 05-Backend-Schema section 9. Keys that must never reach the browser, for the audience named. */
export const RESTRICTED_KEYS: { all: RegExp[]; student: RegExp[] } = {
  all: [
    /^trigger/,
    /^contextGuard$/,
    /^priority/,
    /^ruleBundle/,
    /^predicate/,
    /^prompt/,
    /^generationConfig$/,
    /^triggerEvaluations$/,
    /^eligibleIds$/,
    /^lockArtifactFacts$/,
    /^rawLogs/,
    /^dependencyManifest$/,
    /^evidenceIdMap$/,
    /^answerIdMap$/,
    /^falsifyingSourceRef$/,
    /^plausibilityRationale$/,
    /^scopeCheck$/,
    /^supportExtentRationale$/,
    /^irrelevanceReason$/,
    /^storagePath$/,
    /^acceptedOrders$/,
    /^priorities$/,
    /^keywordPartitions$/,
    /^error$/,
  ],
  student: [
    /^correct/,
    /^answerCorrectness$/,
    /^quality/,
    /^eFactuality$/,
    /^eSupportCompleteness$/,
    /^pairAlignment$/,
    /^teacherLabel$/,
  ],
};

/** Returns the JSON path of every restricted key in `json`, depth first. */
export function findRestrictedKeys(json: unknown, audience: 'teacher' | 'student'): string[] {
  const patterns = audience === 'student' ? [...RESTRICTED_KEYS.all, ...RESTRICTED_KEYS.student] : RESTRICTED_KEYS.all;
  const found: string[] = [];

  const walk = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`));
    } else if (typeof value === 'object' && value !== null) {
      for (const [key, child] of Object.entries(value)) {
        const childPath = `${path}.${key}`;
        if (patterns.some((pattern) => pattern.test(key))) found.push(childPath);
        walk(child, childPath);
      }
    }
  };

  walk(json, '$');
  return found;
}
