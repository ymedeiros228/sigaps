import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const manualDir = join(root, 'docs', 'manual');
const input = join(manualDir, 'MANUAL_ENTREGA.md');
const output = join(manualDir, 'SIGAPS_Manual_Entrega_Oficial.pdf');

const coverHtml = `
<section class="cover-sheet">
  <div class="cover-accent"></div>
  <div class="cover-inner">
    <p class="cover-org">Secretaria Municipal de Saúde</p>
    <p class="cover-city">Passagem Franca — Maranhão</p>
    <h1 class="cover-title">SIGAPS</h1>
    <p class="cover-subtitle">Sistema Inteligente de Gestão das Microáreas da<br>Atenção Primária à Saúde</p>
    <div class="cover-doc-label">MANUAL DE ENTREGA E DOCUMENTAÇÃO TÉCNICA</div>
    <table class="cover-table">
      <tr><td class="lbl">Cliente / Receptor</td><td>Jonas Almeida Medeiros — Enfermeiro da APS</td></tr>
      <tr><td class="lbl">Desenvolvedor</td><td>Yuri Medeiros Bandeira</td></tr>
      <tr><td class="lbl">Versão</td><td>1.0.0 — MVP</td></tr>
      <tr><td class="lbl">Data</td><td>02 de julho de 2026</td></tr>
      <tr><td class="lbl">Produção</td><td>https://sigaps-api.onrender.com</td></tr>
    </table>
    <div class="cover-tags">
      <span>OpenStreetMap</span><span>PostGIS</span><span>NestJS</span><span>React</span><span>PWA</span><span>LGPD</span>
    </div>
  </div>
  <div class="cover-bottom">
    Documento confidencial — Secretaria Municipal de Saúde de Passagem Franca/MA
  </div>
</section>
`;

const css = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; }

  .cover-sheet {
    width: 210mm; height: 297mm; page-break-after: always;
    position: relative; overflow: hidden; background: #0b2e4a; color: #fff;
  }
  .cover-accent {
    position: absolute; top: 0; left: 0; right: 0; height: 8mm;
    background: linear-gradient(90deg, #2e7d32, #4caf50, #1565c0);
  }
  .cover-inner {
    padding: 24mm 20mm 14mm; height: calc(297mm - 20mm);
    display: flex; flex-direction: column; align-items: center; text-align: center;
  }
  .cover-org { margin: 0; font-size: 11pt; text-transform: uppercase; opacity: 0.85; }
  .cover-city { margin: 4px 0 30px; font-size: 13pt; font-weight: 600; }
  .cover-title {
    margin: 0; font-size: 44pt; font-weight: 800; letter-spacing: 4px;
    line-height: 1; border: none; color: #fff;
  }
  .cover-subtitle { margin: 16px 0 30px; font-size: 13pt; line-height: 1.5; max-width: 150mm; }
  .cover-doc-label {
    display: inline-block; padding: 8px 20px; border: 1px solid rgba(255,255,255,0.35);
    border-radius: 4px; font-size: 10pt; font-weight: 700; letter-spacing: 1px;
    margin-bottom: 26px; background: rgba(255,255,255,0.08);
  }
  .cover-table {
    width: 100%; max-width: 165mm; border-collapse: collapse;
    font-size: 10pt; text-align: left; margin-bottom: 22px;
  }
  .cover-table td { padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.15); }
  .cover-table .lbl { width: 38%; font-weight: 700; color: #a5d6a7; }
  .cover-tags { margin-top: auto; display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  .cover-tags span {
    font-size: 8.5pt; padding: 5px 12px; border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.1);
  }
  .cover-bottom {
    position: absolute; bottom: 0; left: 0; right: 0; padding: 10mm 20mm;
    font-size: 8.5pt; text-align: center; opacity: 0.75;
    border-top: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.15);
  }

  .doc-body { padding: 20mm 18mm 24mm; font-size: 10.5pt; line-height: 1.65; text-align: justify; }
  h1 {
    color: #1565C0; font-size: 20pt; border-bottom: 3px solid #1565C0;
    padding-bottom: 10px; margin-top: 0; page-break-before: always;
  }
  h2 { color: #1976D2; font-size: 14pt; margin-top: 24px; border-left: 4px solid #4CAF50; padding-left: 12px; }
  h3 { color: #37474F; font-size: 12pt; margin-top: 18px; }
  table { border-collapse: collapse; width: 100%; margin: 14px 0; font-size: 9.5pt; page-break-inside: avoid; }
  th, td { border: 1px solid #cfd8dc; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: #E3F2FD; color: #1565C0; font-weight: 700; }
  tr:nth-child(even) td { background: #fafafa; }
  img {
    display: block; width: 100%; max-width: 174mm; height: auto; margin: 14px auto;
    border: 1px solid #dde3e8; border-radius: 4px; box-shadow: 0 2px 12px rgba(0,0,0,0.1);
    page-break-inside: avoid;
  }
  img.img-detail { max-width: 115mm; }
  .fig-caption { text-align: center; font-size: 9pt; color: #546E7A; font-style: italic; margin: -6px 0 18px; }
  .fig-caption.fig-hero { font-size: 10pt; font-weight: 600; font-style: normal; color: #37474F; margin-bottom: 22px; }
  .figure-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin: 16px 0 6px;
    page-break-inside: avoid;
  }
  .figure-row img {
    margin: 0;
    width: 100%;
    max-width: none;
    height: auto;
  }
  .toc { page-break-after: always; }
  .toc ol { padding-left: 20px; }
  .flow-step {
    background: #f5f9ff; border: 1px solid #bbdefb; border-radius: 8px;
    padding: 14px 16px; margin: 12px 0; page-break-inside: avoid;
  }
  .flow-step strong { color: #1565C0; }
  .info-box { background: #E3F2FD; border: 1px solid #90CAF9; border-radius: 8px; padding: 12px 16px; margin: 14px 0; }
  .warning-box { background: #FFF3E0; border: 1px solid #FFB74D; border-radius: 8px; padding: 12px 16px; margin: 14px 0; }
  .signature-page { page-break-before: always; }
  .signature-line { border-top: 2px solid #263238; margin-top: 56px; padding-top: 10px; width: 85%; }
  .signature-gov {
    border: 2px dashed #1565C0; border-radius: 8px; padding: 18px; margin-top: 14px;
    min-height: 72px; background: #f8fbff; text-align: center; color: #546E7A; font-size: 9pt;
  }
  hr { border: none; border-top: 1px solid #e0e0e0; margin: 20px 0; }
  ul, ol { padding-left: 22px; }
  li { margin-bottom: 5px; }
`;

const md = readFileSync(input, 'utf8');
const htmlBody = marked.parse(md, { gfm: true });
const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><style>${css}</style></head><body>${coverHtml}<div class="doc-body">${htmlBody}</div></body></html>`;

writeFileSync(join(manualDir, '_build.html'), html, 'utf8');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`file:///${join(manualDir, '_build.html').replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });
await page.pdf({
  path: output,
  format: 'A4',
  printBackground: true,
  margin: { top: '0', bottom: '14mm', left: '0', right: '0' },
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `<div style="width:100%;font-size:7.5pt;color:#90a4ae;padding:0 18mm;display:flex;justify-content:space-between;font-family:Segoe UI,Arial,sans-serif;"><span>SIGAPS — Manual de Entrega · Passagem Franca/MA</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`,
});
await browser.close();
console.log(`PDF gerado: ${output}`);
