import { z } from 'zod';
import { DraftFixture, ReportFixture, RuleBundleFixture } from '@logina/domain';

export const ReaderOutput = z.object({
  language: z.enum(['en', 'vi', 'other']),
  pages: z.array(
    z.object({
      n: z.number(),
      paragraphs: z.array(z.object({ k: z.number(), text: z.string() })),
      tables: z.array(z.object({ k: z.number(), caption: z.string().optional(), dataTable: z.array(z.array(z.string())) })),
      figures: z.array(z.object({ k: z.number(), caption: z.string().optional(), altText: z.string() })),
    }),
  ),
});
export type ReaderOutput = z.infer<typeof ReaderOutput>;

export const AnalyzerOutput = z.object({
  claims: z.array(
    z.object({
      id: z.string(),
      wording: z.string(),
      evidence: z.array(z.object({ locator: z.string(), quote: z.string() })),
    }),
  ),
  issues: z.array(
    z.object({
      issueType: z.enum(['AMBIGUOUS', 'MISSING', 'CONFLICT', 'ASSUMPTION']),
      severity: z.enum(['BLOCKER', 'REVIEW']),
      bubble: z.string(),
      locators: z.array(z.string()),
      suggestions: z.array(z.string()),
    }),
  ),
});

export const GeneratorOutput = z.object({ draft: DraftFixture, ruleBundle: RuleBundleFixture });
export type GeneratorOutput = z.infer<typeof GeneratorOutput>;

export const XReasonOutput = z.object({ gates: ReportFixture.shape.gates });
