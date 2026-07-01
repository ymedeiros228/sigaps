import { mdToPdf } from 'md-to-pdf';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const input = join(root, 'docs', 'DOCUMENTACAO_COMPLETA.md');
const output = join(root, 'docs', 'SIGAPS_Documentacao_Completa.pdf');

const css = `
  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a1a;
    max-width: 100%;
  }
  h1 { color: #1565C0; border-bottom: 2px solid #1565C0; padding-bottom: 8px; page-break-before: always; }
  h1:first-of-type { page-break-before: avoid; }
  h2 { color: #1976D2; margin-top: 24px; }
  h3 { color: #424242; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 10pt; }
  th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
  th { background: #E3F2FD; }
  code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 10pt; }
  pre { background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; }
  blockquote { border-left: 4px solid #1565C0; margin: 0; padding-left: 16px; color: #555; }
`;

console.log('Gerando PDF da documentação SIGAPS...');

await mdToPdf(
  { content: readFileSync(input, 'utf8') },
  {
    dest: output,
    pdf_options: {
      format: 'A4',
      margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' },
      printBackground: true,
    },
    stylesheet: [],
    css,
    launch_options: { args: ['--no-sandbox'] },
  },
);

console.log(`PDF gerado: ${output}`);
