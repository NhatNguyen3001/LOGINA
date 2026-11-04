import { Link } from '@tanstack/react-router';
import { Accessibility, ArrowLeft, FileText, ShieldCheck, type LucideIcon } from 'lucide-react';
import { Fragment, useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LangSwitch } from '@/components/logina/LangSwitch';
import { ModeToggle } from '@/components/logina/ModeToggle';
import { PanelShell } from '@/components/logina/PanelShell';
import { StatusTag } from '@/components/logina/StatusTag';
import accessibility from '@/legal/accessibility-statement.md?raw';
import privacy from '@/legal/privacy-policy.md?raw';
import terms from '@/legal/terms-of-use.md?raw';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cardVariants } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const DOCS = { privacy, terms, accessibility };
type Doc = keyof typeof DOCS;

const DOC_LINKS: { doc: Doc; to: string; icon: LucideIcon }[] = [
  { doc: 'privacy', to: '/privacy', icon: ShieldCheck },
  { doc: 'terms', to: '/terms', icon: FileText },
  { doc: 'accessibility', to: '/accessibility', icon: Accessibility },
];

type Block =
  | { kind: 'h1' | 'h2' | 'meta' | 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'table'; rows: string[][] };

/** Each file holds the Vietnamese text, a rule, then the English text. */
function sectionFor(source: string, lang: string): string {
  const body = source.replace(/<!--[\s\S]*?-->/, '');
  const [vi = '', en = ''] = body.split(/^---$/m);
  return lang === 'vi' ? vi : en;
}

const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());

/** Read line by line: in these files a heading, a table or a list can follow text with no blank line. */
function parse(markdown: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('# ')) blocks.push({ kind: 'h1', text: line.slice(2) });
    else if (line.startsWith('## ')) blocks.push({ kind: 'h2', text: line.slice(3) });
    else if (line.startsWith('- ')) {
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'ul') last.items.push(line.slice(2));
      else blocks.push({ kind: 'ul', items: [line.slice(2)] });
    } else if (line.startsWith('|')) {
      if (/^\|[\s:|-]+\|$/.test(line)) continue;
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'table') last.rows.push(cells(line));
      else blocks.push({ kind: 'table', rows: [cells(line)] });
    } else {
      /** The version, date and contact lines sit right under the title. */
      const underTitle = blocks.every((block) => block.kind === 'h1' || block.kind === 'meta');
      blocks.push({ kind: underTitle && blocks.length > 0 && line.startsWith('**') ? 'meta' : 'p', text: line });
    }
  }
  return blocks;
}

function linked(text: string): ReactNode[] {
  return text.split(/([\w.+-]+@[\w-]+\.[a-z]+)/).map((part, i) => (i % 2 === 1 ? <a key={i} href={`mailto:${part}`}>{part}</a> : <Fragment key={i}>{part}</Fragment>));
}

function inline(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/).map((part, i) => (i % 2 === 1 ? <strong key={i}>{linked(part)}</strong> : <Fragment key={i}>{linked(part)}</Fragment>));
}

function BlockView({ block, tableLabel }: { block: Block; tableLabel: string }) {
  if (block.kind === 'h1') return <h1>{block.text}</h1>;
  if (block.kind === 'meta') return <p className="policy-meta">{inline(block.text)}</p>;
  if (block.kind === 'ul') {
    return (
      <ul>
        {block.items.map((item) => <li key={item}>{inline(item)}</li>)}
      </ul>
    );
  }
  if ('text' in block) return <p>{inline(block.text)}</p>;
  if (!('rows' in block)) return null;
  const head = block.rows[0] ?? [];
  return (
    <div className={cardVariants({ tone: 'flush' })}>
      <Table wrapperProps={{ role: 'region', 'aria-label': tableLabel, tabIndex: 0 }}>
          <TableHeader>
            <TableRow>{head.map((cell) => <TableHead key={cell}>{cell}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {block.rows.slice(1).map((row) => (
              <TableRow key={row[0]}>{row.map((cell) => <TableCell key={cell}>{inline(cell)}</TableCell>)}</TableRow>
            ))}
          </TableBody>
        </Table>
    </div>
  );
}

/** Everything before the first section stays open; each section folds, so a long policy fits on a screen. */
function split(blocks: Block[]) {
  const intro: Block[] = [];
  const sections: { heading: string; blocks: Block[] }[] = [];
  for (const block of blocks) {
    if (block.kind === 'h2') sections.push({ heading: block.text, blocks: [] });
    else (sections[sections.length - 1]?.blocks ?? intro).push(block);
  }
  return { intro, sections };
}

/** Back returns to the page the person came from; a tab opened straight on a policy has none, so it goes to the start. */
function goBack() {
  if (window.history.length > 1) window.history.back();
  else window.location.assign('/');
}

/** Each row fades up once as it first comes into view. Without the class every row simply shows. */
function useRevealOnScroll(...resetWhen: string[]) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = list.current;
    if (!node || typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    node.classList.add('reveal');
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('seen');
        observer.unobserve(entry.target);
      }
    });
    node.querySelectorAll('[data-slot="accordion-item"]').forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  }, resetWhen);
  return list;
}

export function LegalPage({ doc }: { doc: Doc }) {
  const { t, i18n } = useTranslation();
  const list = useRevealOnScroll(doc, i18n.language);
  const section = sectionFor(DOCS[doc], i18n.language);
  const { intro, sections } = split(parse(section));
  const title = t(`teacher.shell.${doc}`);

  const panel = (
    <>
      <nav aria-label={t('common.policies')}>
        <ul className="tasks">
          {DOC_LINKS.map(({ doc: item, to, icon: Icon }) => (
            <li key={item} className={item === doc ? 'on' : undefined}>
              <Link to={to} className="task no-underline" {...(item === doc ? { 'aria-current': 'page' as const } : {})}>
                <Icon className="ico" aria-hidden="true" />
                <span>{t(`teacher.shell.${item}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="stu-tools">
        <div className="prefs">
          <LangSwitch />
          <ModeToggle />
        </div>
      </div>
    </>
  );

  return (
    <PanelShell phoneTitle={title} label={t('common.policies')} panel={panel}>
      <main className="stu-in policy w-full grow">
        <div className="row">
          <button type="button" className={buttonVariants({ variant: 'secondary', size: 'sm' })} onClick={goBack}>
            <ArrowLeft className="ico" aria-hidden="true" />
            {t('common.back')}
          </button>
          {/((bản nháp|draft))/i.test(section) ? <StatusTag kind="review">{t('common.draft')}</StatusTag> : null}
        </div>
        {intro.map((block, index) => <BlockView key={index} block={block} tableLabel={title} />)}
        <Accordion key={doc} ref={list} type="multiple" className="acc-list">
          {sections.map(({ heading, blocks }) => (
            <AccordionItem key={heading} value={heading}>
              <AccordionTrigger heading="h2">{heading}</AccordionTrigger>
              <AccordionContent className="text-base text-ink">
                {blocks.map((block, index) => <BlockView key={index} block={block} tableLabel={heading} />)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </main>
    </PanelShell>
  );
}
