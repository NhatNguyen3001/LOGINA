/** Confidence was saved out of 100 before the switch to 0 to 10 on 5 Nov 2026; an older value reads at the same point out of 10. */
export function tenPointConfidence(value: unknown): number {
  const number = Number(value);
  return number > 10 ? Math.round(number / 10) : number;
}
