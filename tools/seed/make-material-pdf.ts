import { createWriteStream, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

/** Renders the team-written sample material.md to material.pdf. Run `pnpm make:material`, then re-seed. */

const FONT = process.env.MATERIAL_FONT ?? 'C:/Windows/Fonts/arial.ttf';
const FONT_BOLD = process.env.MATERIAL_FONT_BOLD ?? 'C:/Windows/Fonts/arialbd.ttf';

function render(locale: 'en' | 'vi'): void {
  const dir = fileURLToPath(new URL(`../../packages/domain/fixtures/dia-ly-12-bai-8/${locale}/`, import.meta.url));
  const lines = readFileSync(`${dir}material.md`, 'utf8').replace(/\r/g, '').replace(/<!--[\s\S]*?-->/g, '').split('\n');

  const doc = new PDFDocument({ size: 'A4', margin: 56, autoFirstPage: false, info: { Title: 'LOGINA sample material' } });
  doc.pipe(createWriteStream(`${dir}material.pdf`));
  doc.registerFont('body', FONT).registerFont('bold', FONT_BOLD);
  doc.addPage().font('body').fontSize(11);

  let firstPageMarker = true;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('{{page ')) {
      if (!firstPageMarker) doc.addPage();
      firstPageMarker = false;
    } else if (line.startsWith('{{') || line === '' || /^\|[-| ]+\|$/.test(line)) {
      continue;
    } else if (line.startsWith('# ')) {
      doc.font('bold').fontSize(16).text(line.slice(2)).moveDown(0.5);
    } else if (line.startsWith('## ')) {
      doc.font('bold').fontSize(13).text(line.slice(3)).moveDown(0.4);
    } else if (line.startsWith('|')) {
      const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
      doc.font('body').fontSize(10).text(cells.join('    ')).moveDown(0.2);
    } else {
      const text = line.replace(/^>\s*/, '').replace(/\*\*|\*/g, '');
      doc.font('body').fontSize(11).text(text, { align: 'left' }).moveDown(0.6);
    }
  }
  doc.end();
}

render('en');
render('vi');
