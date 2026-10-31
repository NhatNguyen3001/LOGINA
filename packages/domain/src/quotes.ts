import { normalizeText } from './normalize.js';

export interface Quote {
  locator: string;
  quote: string;
}

/** A quote survives only if it is verbatim in the unit it cites, so AI can't invent or alter a figure. */
export function checkQuotes(units: { locator: string; text: string }[], evidence: Quote[]): { kept: Quote[]; dropped: Quote[] } {
  const textOf = new Map(units.map((unit) => [unit.locator, normalizeText(unit.text)]));
  const found = ({ locator, quote }: Quote): boolean => textOf.get(locator)?.includes(normalizeText(quote)) ?? false;
  return { kept: evidence.filter(found), dropped: evidence.filter((q) => !found(q)) };
}
