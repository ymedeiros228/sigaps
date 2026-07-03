import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'fs';
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
  <div class="cover-badge">DOCUMENTO OFICIAL DE ENTREGA</div>
  <div class="cover-inner">
    <p class="cover-org">Entrega ao cliente</p>
    <p class="cover-city">Jonas Almeida Medeiros · Enfermeiro APS · Passagem Franca/MA</p>
    <h1 class="cover-title">SIGAPS</h1>
    <p class="cover-subtitle">Sistema Inteligente de Gestão das Microáreas da<br>Atenção Primária à Saúde</p>
    <div class="cover-doc-label">MANUAL TÉCNICO · CONTRATO DE ENTREGA E ACEITE</div>
    <table class="cover-table">
      <tr><td class="lbl">Cliente / Receptor</td><td class="val">Jonas Almeida Medeiros — Enfermeiro da APS</td></tr>
      <tr><td class="lbl">Município</td><td class="val">Passagem Franca — Maranhão</td></tr>
      <tr><td class="lbl">Desenvolvedor</td><td class="val">Yuri Medeiros Bandeira — Programador / Responsável técnico</td></tr>
      <tr><td class="lbl">Versão do sistema</td><td class="val">1.0.0 — MVP</td></tr>
      <tr><td class="lbl">Data da entrega</td><td class="val">03 de julho de 2026</td></tr>
      <tr><td class="lbl">Ambiente de produção</td><td class="val">sigaps-api.onrender.com</td></tr>
      <tr><td class="lbl">Repositório</td><td class="val">github.com/ymedeiros228/sigaps</td></tr>
    </table>
    <div class="cover-tags">
      <span>OpenStreetMap</span><span>PostGIS</span><span>NestJS</span><span>React</span><span>PWA</span><span>LGPD</span>
    </div>
  </div>
  <div class="cover-bottom">
    Manual de entrega do sistema SIGAPS — Cliente: Jonas Almeida Medeiros · Enfermeiro APS · Passagem Franca/MA
  </div>
</section>
`;

const backCoverHtml = `
<section class="back-cover">
  <div class="back-accent"></div>
  <div class="back-inner">
    <p class="back-title">SIGAPS v1.0.0-MVP</p>
    <p class="back-text">Sistema implantado em produção e documentado conforme requisitos de gestão territorial da APS.</p>
    <table class="back-table">
      <tr><td class="lbl">Desenvolvedor</td><td class="val">Yuri Medeiros Bandeira</td></tr>
      <tr><td class="lbl">Cliente</td><td class="val">Jonas Almeida Medeiros — Enfermeiro APS</td></tr>
      <tr><td class="lbl">Município</td><td class="val">Passagem Franca — Maranhão</td></tr>
      <tr><td class="lbl">Data da entrega</td><td class="val">03 de julho de 2026</td></tr>
      <tr><td class="lbl">Produção</td><td class="val">sigaps-api.onrender.com</td></tr>
      <tr><td class="lbl">Repositório</td><td class="val">github.com/ymedeiros228/sigaps</td></tr>
    </table>
    <p class="back-note">Licença MIT — Código-fonte aberto</p>
  </div>
</section>
`;

const css = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; }

  .cover-sheet {
    width: 210mm; height: 297mm; page-break-after: always;
    position: relative; overflow: hidden; background: linear-gradient(165deg, #0b2e4a 0%, #0d3d5c 55%, #0a2540 100%); color: #fff;
  }
  .cover-accent {
    position: absolute; top: 0; left: 0; right: 0; height: 8mm;
    background: linear-gradient(90deg, #2e7d32, #4caf50, #1565c0);
  }
  .cover-badge {
    position: absolute; top: 14mm; right: 16mm;
    font-size: 7.5pt; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase;
    padding: 6px 12px; border: 1px solid rgba(255,255,255,0.35); border-radius: 3px;
    background: rgba(255,255,255,0.1);
  }
  .cover-inner {
    padding: 22mm 18mm 12mm; height: calc(297mm - 18mm);
    display: flex; flex-direction: column; align-items: center; text-align: center;
  }
  .cover-org { margin: 8mm 0 0; font-size: 10.5pt; text-transform: uppercase; letter-spacing: 1px; opacity: 0.88; }
  .cover-city { margin: 4px 0 22px; font-size: 13pt; font-weight: 600; }
  .cover-title {
    margin: 0; font-size: 46pt; font-weight: 800; letter-spacing: 5px;
    line-height: 1; border: none; color: #fff;
  }
  .cover-subtitle { margin: 14px 0 22px; font-size: 12.5pt; line-height: 1.55; max-width: 152mm; opacity: 0.95; }
  .cover-doc-label {
    display: inline-block; padding: 9px 22px; border: 1px solid rgba(255,255,255,0.4);
    border-radius: 4px; font-size: 9.5pt; font-weight: 700; letter-spacing: 0.8px;
    margin-bottom: 20px; background: rgba(255,255,255,0.1);
  }
  .cover-table {
    width: 100%; max-width: 168mm; border-collapse: collapse;
    font-size: 9.5pt; text-align: left; margin-bottom: 18px;
  }
  .cover-table td { padding: 7px 10px; border-bottom: 1px solid rgba(255,255,255,0.14); vertical-align: top; background: transparent !important; color: #fff !important; }
  .cover-table .lbl { width: 36%; font-weight: 700; color: #a5d6a7 !important; white-space: nowrap; }
  .cover-table .val { color: #fff !important; }
  .cover-tags { margin-top: auto; display: flex; flex-wrap: wrap; gap: 7px; justify-content: center; }
  .cover-tags span {
    font-size: 8pt; padding: 4px 11px; border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.28); background: rgba(255,255,255,0.08);
  }
  .cover-bottom {
    position: absolute; bottom: 0; left: 0; right: 0; padding: 9mm 18mm;
    font-size: 8pt; text-align: center; opacity: 0.78;
    border-top: 1px solid rgba(255,255,255,0.18); background: rgba(0,0,0,0.18);
  }

  .back-cover {
    width: 210mm; height: 297mm; page-break-before: always;
    position: relative; background: #0b2e4a; color: #fff;
    display: flex; align-items: center; justify-content: center;
  }
  .back-accent {
    position: absolute; bottom: 0; left: 0; right: 0; height: 6mm;
    background: linear-gradient(90deg, #1565c0, #4caf50, #2e7d32);
  }
  .back-inner { text-align: center; padding: 20mm; max-width: 150mm; }
  .back-title { font-size: 22pt; font-weight: 800; letter-spacing: 3px; margin: 0 0 12px; }
  .back-text { font-size: 10.5pt; line-height: 1.6; opacity: 0.9; margin-bottom: 24px; }
  .back-table { width: 100%; font-size: 9.5pt; border-collapse: collapse; margin: 0 auto 20px; text-align: left; }
  .back-table td { padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.15); background: transparent !important; color: #fff !important; }
  .back-table .lbl { font-weight: 700; color: #a5d6a7 !important; width: 38%; white-space: nowrap; }
  .back-table .val { color: #fff !important; }
  .back-note { font-size: 8.5pt; opacity: 0.7; margin-top: 16px; }

  .doc-body { padding: 18mm 17mm 22mm; font-size: 10.5pt; line-height: 1.62; text-align: justify; }
  h1 {
    color: #1565C0; font-size: 19pt; border-bottom: 3px solid #1565C0;
    padding-bottom: 9px; margin-top: 0; page-break-before: always;
  }
  h1:first-of-type { page-break-before: avoid; }
  h2 { color: #1976D2; font-size: 13.5pt; margin-top: 22px; border-left: 4px solid #4CAF50; padding-left: 11px; }
  h3 { color: #37474F; font-size: 11.5pt; margin-top: 16px; }
  .doc-body table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 9.5pt; page-break-inside: avoid; }
  .doc-body th, .doc-body td { border: 1px solid #cfd8dc; padding: 7px 9px; text-align: left; vertical-align: top; }
  .doc-body th { background: #E3F2FD; color: #1565C0; font-weight: 700; }
  .doc-body tr:nth-child(even) td { background: #fafafa; }
  img {
    display: block; width: 100%; max-width: 176mm; height: auto; margin: 12px auto;
    border: 1px solid #d5dde4; border-radius: 5px; box-shadow: 0 2px 14px rgba(0,0,0,0.09);
    page-break-inside: avoid;
  }
  img.img-detail { max-width: 115mm; }
  .fig-caption { text-align: center; font-size: 8.8pt; color: #546E7A; font-style: italic; margin: -4px 0 16px; line-height: 1.45; }
  .fig-caption.fig-hero { font-size: 9.8pt; font-weight: 600; font-style: normal; color: #37474F; margin-bottom: 20px; }
  .figure-row {
    display: grid; grid-template-columns: 1fr 1fr; gap: 9px;
    margin: 14px 0 4px; page-break-inside: avoid;
  }
  .figure-row img { margin: 0; width: 100%; max-width: none; height: auto; }
  .toc { page-break-after: always; padding-bottom: 8mm; }
  .toc h2 { border: none; padding: 0; margin: 0 0 14px; font-size: 16pt; color: #1565C0; text-align: center; }
  .toc ol {
    padding-left: 0; list-style: none; counter-reset: toc;
    max-width: 168mm; margin: 0 auto;
  }
  .toc ol li {
    counter-increment: toc; padding: 7px 0; border-bottom: 1px dotted #cfd8dc;
    font-size: 10pt;
  }
  .toc ol li::before {
    content: counter(toc) ". "; font-weight: 700; color: #1565C0; margin-right: 6px;
  }
  .toc ol li a { color: #263238; text-decoration: none; }
  .contract-banner {
    background: linear-gradient(135deg, #e8f5e9, #e3f2fd);
    border: 1px solid #90caf9; border-radius: 8px; padding: 14px 16px; margin: 16px 0;
    page-break-inside: avoid; text-align: center;
  }
  .contract-banner strong { color: #1565C0; font-size: 11pt; }
  .flow-step {
    background: #f5f9ff; border: 1px solid #bbdefb; border-radius: 8px;
    padding: 13px 15px; margin: 11px 0; page-break-inside: avoid;
  }
  .flow-step strong { color: #1565C0; }
  .info-box { background: #E3F2FD; border: 1px solid #90CAF9; border-radius: 8px; padding: 11px 15px; margin: 12px 0; page-break-inside: avoid; }
  .warning-box { background: #FFF3E0; border: 1px solid #FFB74D; border-radius: 8px; padding: 11px 15px; margin: 12px 0; page-break-inside: avoid; }
  .signature-page { page-break-before: always; }
  .signature-page h1 { color: #263238; border-bottom-color: #263238; }
  .signature-block { margin: 28px 0; page-break-inside: avoid; }
  .signature-block h3 { margin-top: 0; color: #1565C0; font-size: 12pt; border-bottom: 2px solid #e0e0e0; padding-bottom: 6px; }
  .signature-line {
    border-top: 2px solid #263238; margin-top: 52px; padding-top: 9px; width: 88%;
    font-size: 10pt;
  }
  .signature-gov {
    border: 2px dashed #1565C0; border-radius: 8px; padding: 16px; margin-top: 12px;
    min-height: 68px; background: #f8fbff; text-align: center; color: #546E7A; font-size: 8.8pt;
  }
  hr { border: none; border-top: 1px solid #e0e0e0; margin: 18px 0; }
  ul, ol { padding-left: 22px; }
  li { margin-bottom: 4px; }
  p { orphans: 3; widows: 3; }
  code { background: #f5f5f5; padding: 1px 5px; border-radius: 3px; font-size: 9pt; }
`;

let md = readFileSync(input, 'utf8');

// Garantir imagens com caminho absoluto para o Playwright
const screenshotDir = join(manualDir, 'screenshots').replace(/\\/g, '/');
md = md.replace(/\]\(screenshots\//g, `](file:///${screenshotDir}/`);

const htmlBody = marked.parse(md, { gfm: true });
const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><style>${css}</style></head><body>${coverHtml}<div class="doc-body">${htmlBody}</div>${backCoverHtml}</body></html>`;

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
  footerTemplate: `<div style="width:100%;font-size:7.5pt;color:#90a4ae;padding:0 17mm;display:flex;justify-content:space-between;font-family:Segoe UI,Arial,sans-serif;"><span>SIGAPS — Manual de Entrega e Aceite · Passagem Franca/MA · 03/07/2026</span><span>Pág. <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
});
await browser.close();
console.log(`PDF gerado: ${output}`);
