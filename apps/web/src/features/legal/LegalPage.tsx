import { Link } from '@tanstack/react-router';
import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LangSwitch } from '@/components/logina/LangSwitch';
import { Logo } from '@/components/logina/Logo';
import accessibility from '@/legal/accessibility-statement.md?raw';
import privacy from '@/legal/privacy-policy.md?raw';
import terms from '@/legal/terms-of-use.md?raw';

const DOCS = { privacy, terms, accessibility };

/** Each file holds the Vietnamese text, a rule, then the English text. */
function sectionFor(source: string, lang: string): string {
  const body = source.replace(/<!--[\s\S]*?-->/, '');
  const [vi = '', en = ''] = body.split(/^---$/m);
  return lang === 'vi' ? vi : en;
}

function inline(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/).map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>));
}

function render(markdown: string): ReactNode[] {
  return markdown
    .trim()
    .split(/\n\s*\n/)
    .map((block, i) => {
      if (block.startsWith('# ')) return <h1 key={i}>{block.slice(2)}</h1>;
      if (block.startsWith('## ')) return <h2 key={i}>{block.slice(3)}</h2>;
      if (block.startsWith('- ')) {
        return (
          <ul key={i}>
            {block.split(/\n- /).map((item, j) => (
              <li key={j}>{inline(item.replace(/^- /, ''))}</li>
            ))}
          </ul>
        );
      }
      return <p key={i}>{inline(block)}</p>;
    });
}

export function LegalPage({ doc }: { doc: keyof typeof DOCS }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="min-h-dvh bg-page">
      <div className="pol-top">
        <div className="pol-in row">
          <Logo />
          <span className="sp" />
          <LangSwitch />
          <Link to="/" className="lnk">{t('common.backHome')}</Link>
        </div>
      </div>
      <main className="pol-in policy">{render(sectionFor(DOCS[doc], i18n.language))}</main>
    </div>
  );
}
