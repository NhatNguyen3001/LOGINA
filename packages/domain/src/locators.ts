export interface Reading {
  pages: {
    n: number;
    paragraphs: { k: number; text: string }[];
    tables: { k: number; caption?: string | undefined; dataTable: string[][] }[];
    figures: { k: number; caption?: string | undefined; altText: string }[];
  }[];
}

export interface SourceUnitDoc {
  id: string;
  materialVersionId: string;
  unitType: 'FACT' | 'CONTEXT';
  span: { page: number; paragraph?: number; table?: string };
  text: string;
  readBy: 'AI';
  figure?: { altText: string; dataTable?: string[][] };
}

/** Locators follow the sample's scheme: `pN-K`, `tN-K`, `figN-K`. For DOCX, N is the section. */
export function toSourceUnits(materialVersionId: string, reading: Reading): SourceUnitDoc[] {
  return reading.pages.flatMap((page): SourceUnitDoc[] => {
    const base = { materialVersionId, readBy: 'AI' as const };
    return [
      ...page.paragraphs.map((p) => ({
        ...base,
        id: `p${page.n}-${p.k}`,
        unitType: 'FACT' as const,
        span: { page: page.n, paragraph: p.k },
        text: p.text,
      })),
      ...page.tables.map((t) => ({
        ...base,
        id: `t${page.n}-${t.k}`,
        unitType: 'FACT' as const,
        span: { page: page.n, table: `${page.n}.${t.k}` },
        text: [t.caption ?? '', ...t.dataTable.map((row) => row.join(' | '))].filter(Boolean).join('\n'),
        figure: { altText: t.caption ?? `Table ${page.n}.${t.k}`, dataTable: t.dataTable },
      })),
      ...page.figures.map((f) => ({
        ...base,
        id: `fig${page.n}-${f.k}`,
        unitType: 'CONTEXT' as const,
        span: { page: page.n },
        text: f.caption ?? f.altText,
        figure: { altText: f.altText },
      })),
    ];
  });
}
