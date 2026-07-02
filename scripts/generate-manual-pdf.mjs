import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const manualDir = join(root, 'docs', 'manual');
const input = join(manualDir, 'MANUAL_ENTREGA.md');
const output = join(manualDir, 'SIGAPS_Manual_Entrega_Oficial.pdf');

const css = `
  @page {
    size: A4;
    margin: 22mm 18mm 24mm 18mm;
  }
  @page :first {
    margin: 0;
  }
  body {
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.65;
    color: #1a1a2e;
    text-align: justify;
    hyphens: auto;
  }

  /* Capa */
  .cover-page {
    page-break-after: always;
    height: 297mm;
    width: 210mm;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: linear-gradient(160deg, #0d3b2e 0%, #1565C0 55%, #0a1628 100%);
    color: #fff;
    box-sizing: border-box;
    padding: 28mm 24mm;
  }
  .cover-page h1 {
    font-size: 36pt;
    font-weight: 800;
    letter-spacing: 2px;
    margin: 0 0 8px;
    border: none;
    color: #fff;
    page-break-before: avoid;
  }
  .cover-subtitle {
    font-size: 14pt;
    font-weight: 400;
    opacity: 0.92;
    margin-bottom: 32px;
  }
  .cover-meta {
    font-size: 11pt;
    line-height: 1.8;
    opacity: 0.9;
  }
  .cover-meta strong { color: #a5d6a7; }
  .cover-footer {
    font-size: 9pt;
    opacity: 0.75;
    border-top: 1px solid rgba(255,255,255,0.25);
    padding-top: 16px;
  }
  .cover-badge {
    display: inline-block;
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 9pt;
    margin-right: 8px;
    margin-bottom: 8px;
  }

  h1 {
    color: #1565C0;
    font-size: 20pt;
    border-bottom: 3px solid #1565C0;
    padding-bottom: 10px;
    margin-top: 0;
    page-break-before: always;
  }
  h1:first-of-type { page-break-before: avoid; }
  h2 {
    color: #1976D2;
    font-size: 14pt;
    margin-top: 28px;
    border-left: 4px solid #4CAF50;
    padding-left: 12px;
  }
  h3 {
    color: #37474F;
    font-size: 12pt;
    margin-top: 20px;
  }
  h4 { color: #546E7A; font-size: 11pt; }

  table {
    border-collapse: collapse;
    width: 100%;
    margin: 16px 0;
    font-size: 9.5pt;
    page-break-inside: avoid;
  }
  th, td {
    border: 1px solid #cfd8dc;
    padding: 8px 10px;
    text-align: left;
    vertical-align: top;
  }
  th {
    background: #E3F2FD;
    color: #1565C0;
    font-weight: 700;
  }
  tr:nth-child(even) td { background: #fafafa; }

  img {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 16px auto;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    page-break-inside: avoid;
  }
  .fig-caption {
    text-align: center;
    font-size: 9pt;
    color: #546E7A;
    font-style: italic;
    margin-top: -8px;
    margin-bottom: 20px;
  }

  blockquote {
    border-left: 4px solid #4CAF50;
    margin: 16px 0;
    padding: 12px 16px;
    background: #f1f8e9;
    color: #33691e;
    border-radius: 0 6px 6px 0;
  }

  code {
    background: #f5f5f5;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 9.5pt;
    font-family: Consolas, 'Courier New', monospace;
  }
  pre {
    background: #263238;
    color: #eceff1;
    padding: 14px;
    border-radius: 6px;
    font-size: 9pt;
    overflow-x: auto;
  }

  ul, ol { margin: 8px 0 16px; padding-left: 22px; }
  li { margin-bottom: 6px; }

  .toc { page-break-after: always; }
  .toc ul { list-style: none; padding-left: 0; }
  .toc li {
    border-bottom: 1px dotted #ccc;
    padding: 6px 0;
    display: flex;
    justify-content: space-between;
  }
  .toc a { color: #1565C0; text-decoration: none; }

  .signature-page {
    page-break-before: always;
    min-height: 240mm;
  }
  .signature-block {
    margin-top: 48px;
    page-break-inside: avoid;
  }
  .signature-line {
    border-top: 2px solid #263238;
    margin-top: 64px;
    padding-top: 10px;
    width: 85%;
  }
  .signature-gov {
    border: 2px dashed #1565C0;
    border-radius: 8px;
    padding: 20px;
    margin-top: 16px;
    min-height: 80px;
    background: #f8fbff;
    text-align: center;
    color: #546E7A;
    font-size: 9pt;
  }
  .info-box {
    background: #E3F2FD;
    border: 1px solid #90CAF9;
    border-radius: 8px;
    padding: 14px 18px;
    margin: 16px 0;
    font-size: 10pt;
  }
  .warning-box {
    background: #FFF3E0;
    border: 1px solid #FFB74D;
    border-radius: 8px;
    padding: 14px 18px;
    margin: 16px 0;
  }

  hr {
    border: none;
    border-top: 1px solid #e0e0e0;
    margin: 24px 0;
  }
`;

console.log('Gerando Manual de Entrega SIGAPS (PDF oficial)…');

const md = readFileSync(input, 'utf8');
const htmlBody = marked.parse(md, { gfm: true });
const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <style>${css}</style>
</head>
<body>${htmlBody}</body>
</html>`;

const tmpHtml = join(manualDir, '_build.html');
writeFileSync(tmpHtml, html, 'utf8');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`file:///${tmpHtml.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });
await page.pdf({
  path: output,
  format: 'A4',
  printBackground: true,
  margin: { top: '22mm', bottom: '24mm', left: '18mm', right: '18mm' },
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `
    <div style="width:100%;font-size:8pt;color:#78909c;padding:0 18mm;display:flex;justify-content:space-between;font-family:Segoe UI,Arial,sans-serif;">
      <span>SIGAPS — Manual de Entrega Oficial</span>
      <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
    </div>`,
});
await browser.close();

console.log(`PDF gerado: ${output}`);
