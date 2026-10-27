import type { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { Microarea, Street } from '../services/api';
import { formatStreetLabel } from './streetSearch';
import { getStreetSideAssignment } from './streetPaintSegments';

export type PdfFormat = 'a4' | 'a3';

export interface MunicipalityPdfInfo {
  name: string;
  state: string;
  prefecture: string;
  secretariat: string;
  logoUrl?: string | null;
}

export interface OfficialMapPdfInput {
  format: PdfFormat;
  mapImageDataUrl: string;
  mapImageWidth: number;
  mapImageHeight: number;
  /** Metros por pixel da imagem capturada (para a escala gráfica). Sem ele, a escala não é desenhada. */
  mapMetersPerPixel?: number | null;
  municipality: MunicipalityPdfInfo;
  microareas: Microarea[];
  streets: Street[];
  neighborhoodName?: string;
  ubsList?: Array<{ name: string; address: string }>;
  includeSignatures?: boolean;
  homologation?: {
    at: string;
    by: string;
    notes?: string | null;
  };
}

type RGB = [number, number, number];

type MicroareaRow = {
  microarea: Microarea;
  streets: Street[];
  streetCount: number;
  familyCount: number;
  inhabitantCount: number;
};

const BRAND: RGB = [15, 61, 46];
const INK: RGB = [33, 37, 41];
const MUTED: RGB = [110, 116, 122];
const RULE: RGB = [214, 218, 222];
const ZEBRA: RGB = [246, 248, 247];
const UNPAINTED: RGB = [150, 150, 150];

// ---------------------------------------------------------------------------
// Diagramação da 1ª página. Nada fica por cima do mapa: legenda, escala e norte
// ficam na faixa logo abaixo dele; o quadro completo vai para a página seguinte.
// ---------------------------------------------------------------------------

type Layout = {
  isA3: boolean;
  pageW: number;
  pageH: number;
  margin: number;
  headerH: number;
  mapX: number;
  mapY: number;
  mapW: number;
  mapH: number;
  stripY: number;
  legendCols: number;
  legendLines: number;
  legendLineH: number;
  legendW: number;
  toolsW: number;
  signatureH: number;
  footerTop: number;
  metaTop: number;
};

function computeLayout(format: PdfFormat, legendItems: number, includeSignatures: boolean): Layout {
  const isA3 = format === 'a3';
  const pageW = isA3 ? 420 : 297;
  const pageH = isA3 ? 297 : 210;
  const margin = isA3 ? 12 : 10;
  const headerH = isA3 ? 26 : 21;
  const signatureH = includeSignatures ? (isA3 ? 16 : 14) : 0;
  const metaH = isA3 ? 17 : 15;
  const footerTop = pageH - margin - metaH - signatureH;
  const metaTop = footerTop + signatureH + (includeSignatures ? 1.5 : 0);

  const mapX = margin;
  const mapW = pageW - margin * 2;
  const mapY = headerH + (isA3 ? 6 : 5);

  const toolsW = isA3 ? 74 : 60;
  const legendW = mapW - toolsW - 6;
  const legendCols = isA3 ? 5 : 4;
  const legendLineH = isA3 ? 5.2 : 4.6;
  const legendLines = Math.min(3, Math.max(1, Math.ceil(legendItems / legendCols)));
  const stripH = Math.max(4 + legendLines * legendLineH, isA3 ? 15 : 13) + 2;

  const stripY = footerTop - (includeSignatures ? 3 : 2) - stripH;
  const mapH = stripY - 2 - mapY;

  return {
    isA3, pageW, pageH, margin, headerH, mapX, mapY, mapW, mapH, stripY,
    legendCols, legendLines, legendLineH, legendW, toolsW, signatureH, footerTop, metaTop,
  };
}

/** Proporção (largura/altura) da janela do mapa na folha; a captura enquadra as ruas nela. */
export function officialMapBoxRatio(format: PdfFormat, microareaCount: number, includeSignatures: boolean): number {
  const l = computeLayout(format, microareaCount + 1, includeSignatures);
  return l.mapW / l.mapH;
}

export function countMicroareasOnMap(microareas: Microarea[], streets: Street[]): number {
  return buildMicroareaRows(microareas, streets).length;
}

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

async function loadImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Texto escuro sobre cores claras (amarelo, ciano…), branco sobre as escuras. */
function textOn([r, g, b]: RGB): RGB {
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? INK : [255, 255, 255];
}

function setText(pdf: jsPDF, color: RGB, size: number, style: 'normal' | 'bold' | 'italic' = 'normal') {
  pdf.setTextColor(color[0], color[1], color[2]);
  pdf.setFontSize(size);
  pdf.setFont('helvetica', style);
}

function truncate(pdf: jsPDF, text: string, maxW: number): string {
  if (maxW <= 0) return '';
  if (pdf.getTextWidth(text) <= maxW) return text;
  let out = text;
  while (out.length > 1 && pdf.getTextWidth(`${out}…`) > maxW) {
    out = out.slice(0, -1);
  }
  return `${out.trimEnd()}…`;
}

function streetsOfMicroarea(streets: Street[], microareaId: string): Street[] {
  return streets.filter(
    (s) => s.microareaId === microareaId || s.paintSegments?.some((seg) => seg.microareaId === microareaId),
  );
}

function buildMicroareaRows(microareas: Microarea[], streets: Street[]): MicroareaRow[] {
  return microareas
    .map((microarea) => {
      const maStreets = streetsOfMicroarea(streets, microarea.id).sort((a, b) =>
        formatStreetLabel(a).localeCompare(formatStreetLabel(b), 'pt-BR'),
      );
      return {
        microarea,
        streets: maStreets,
        streetCount: maStreets.length,
        familyCount: maStreets.reduce((sum, s) => sum + (s.familyCount ?? 0), 0),
        inhabitantCount: maStreets.reduce((sum, s) => sum + (s.inhabitantCount ?? 0), 0),
      };
    })
    .filter((row) => row.streetCount > 0)
    .sort((a, b) => a.microarea.number - b.microarea.number);
}

function formatNumber(n: number): string {
  return n.toLocaleString('pt-BR');
}

/** Imagem preenchendo a caixa (corte central se a proporção for diferente). Devolve o trecho usado. */
async function drawCoverImage(
  pdf: jsPDF,
  dataUrl: string,
  x: number,
  y: number,
  boxW: number,
  boxH: number,
  imgW: number,
  imgH: number,
): Promise<{ srcW: number }> {
  if (imgW <= 0 || imgH <= 0) {
    pdf.addImage(dataUrl, 'PNG', x, y, boxW, boxH);
    return { srcW: imgW };
  }
  const boxRatio = boxW / boxH;
  let sx = 0;
  let sy = 0;
  let sw = imgW;
  let sh = imgH;
  if (imgW / imgH > boxRatio) {
    sw = imgH * boxRatio;
    sx = (imgW - sw) / 2;
  } else {
    sh = imgW / boxRatio;
    sy = (imgH - sh) / 2;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw);
  canvas.height = Math.round(sh);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    pdf.addImage(dataUrl, 'PNG', x, y, boxW, boxH);
    return { srcW: imgW };
  }

  const img = new Image();
  img.src = dataUrl;
  const loaded = await new Promise<boolean>((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
  });
  if (!loaded) {
    pdf.addImage(dataUrl, 'PNG', x, y, boxW, boxH);
    return { srcW: imgW };
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  // JPEG: o PDF fica bem menor (bom para mandar no WhatsApp) sem perda visível no mapa.
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', x, y, boxW, boxH);
  return { srcW: sw };
}

// ---------------------------------------------------------------------------
// Peças da 1ª página
// ---------------------------------------------------------------------------

const NICE_METERS = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000];

function formatMeters(m: number): string {
  return m >= 1000 ? `${formatNumber(m / 1000)} km` : `${m} m`;
}

/** Escala gráfica de verdade (calculada do zoom da captura). Devolve a largura usada. */
function drawScaleBar(pdf: jsPDF, rightX: number, y: number, metersPerMm: number, isA3: boolean): number {
  const target = metersPerMm * (isA3 ? 40 : 30);
  let meters = NICE_METERS[0];
  for (const m of NICE_METERS) if (m <= target) meters = m;
  const widthMm = meters / metersPerMm;
  const x = rightX - widthMm - 4;
  const h = isA3 ? 2 : 1.7;
  const seg = widthMm / 4;

  pdf.setDrawColor(INK[0], INK[1], INK[2]);
  pdf.setLineWidth(0.2);
  for (let i = 0; i < 4; i++) {
    if (i % 2 === 0) pdf.setFillColor(INK[0], INK[1], INK[2]);
    else pdf.setFillColor(255, 255, 255);
    pdf.rect(x + seg * i, y, seg, h, 'FD');
  }
  setText(pdf, INK, isA3 ? 6.5 : 5.8);
  pdf.text('0', x, y + h + 3, { align: 'center' });
  pdf.text(formatMeters(meters / 2), x + widthMm / 2, y + h + 3, { align: 'center' });
  pdf.text(formatMeters(meters), x + widthMm, y + h + 3, { align: 'center' });
  setText(pdf, MUTED, isA3 ? 5.8 : 5.2);
  pdf.text('Escala gráfica', x, y - 1.5);
  return widthMm + 8;
}

function drawNorthArrow(pdf: jsPDF, x: number, y: number, size: number) {
  const cx = x + size / 2;
  const top = y + size * 0.36;
  const bottom = y + size;
  const half = size * 0.22;
  pdf.setLineWidth(0.25);
  pdf.setDrawColor(INK[0], INK[1], INK[2]);
  pdf.setFillColor(INK[0], INK[1], INK[2]);
  pdf.triangle(cx, top, cx - half, bottom, cx, bottom - size * 0.16, 'FD');
  pdf.setFillColor(255, 255, 255);
  pdf.triangle(cx, top, cx + half, bottom, cx, bottom - size * 0.16, 'FD');
  setText(pdf, INK, size * 0.75, 'bold');
  pdf.text('N', cx, y + size * 0.3, { align: 'center' });
}

function drawLegendStrip(pdf: jsPDF, l: Layout, rows: MicroareaRow[], metersPerMm: number | null) {
  const { isA3, mapX, stripY, legendCols, legendLines, legendLineH, legendW } = l;

  setText(pdf, BRAND, isA3 ? 7 : 6.3, 'bold');
  pdf.text('LEGENDA', mapX, stripY + 3);

  const capacity = legendCols * legendLines;
  const items: Array<{ color: RGB; text: string; dashed?: boolean }> = rows.map((r) => ({
    color: hexToRgb(r.microarea.color),
    text: r.microarea.acs?.name ? `${r.microarea.name} · ${r.microarea.acs.name}` : r.microarea.name,
  }));
  items.push({ color: UNPAINTED, text: 'Rua sem microárea', dashed: true });
  let shown = items;
  if (items.length > capacity) {
    shown = items.slice(0, capacity - 1);
    shown.push({ color: [255, 255, 255], text: `+ ${items.length - capacity + 1} no quadro da página 2` });
  }

  const chipW = legendW / legendCols;
  const swatchW = isA3 ? 6 : 5;
  setText(pdf, INK, isA3 ? 6.6 : 5.9);
  shown.forEach((item, i) => {
    const col = i % legendCols;
    const line = Math.floor(i / legendCols);
    const x = mapX + col * chipW;
    const y = stripY + 5.5 + line * legendLineH;
    const isMore = item.text.startsWith('+ ');
    if (!isMore) {
      pdf.setDrawColor(item.color[0], item.color[1], item.color[2]);
      pdf.setLineWidth(isA3 ? 1.1 : 0.95);
      if (item.dashed) pdf.setLineDashPattern([0.8, 0.6], 0);
      pdf.line(x, y + 1.6, x + swatchW, y + 1.6);
      if (item.dashed) pdf.setLineDashPattern([], 0);
    }
    pdf.setTextColor(isMore ? MUTED[0] : INK[0], isMore ? MUTED[1] : INK[1], isMore ? MUTED[2] : INK[2]);
    const tx = isMore ? x : x + swatchW + 1.8;
    pdf.text(truncate(pdf, item.text, chipW - (tx - x) - 2), tx, y + 2.6);
  });

  // Norte e escala à direita, fora do mapa
  const rightX = mapX + l.mapW;
  const northSize = isA3 ? 11 : 9.5;
  drawNorthArrow(pdf, rightX - northSize, stripY + 1.5, northSize);
  if (metersPerMm && Number.isFinite(metersPerMm) && metersPerMm > 0) {
    drawScaleBar(pdf, rightX - northSize - 4, stripY + 6.5, metersPerMm, isA3);
  }
}

function drawSignatureRow(pdf: jsPDF, l: Layout) {
  const { margin, pageW, footerTop, isA3 } = l;
  const width = pageW - margin * 2;
  const gap = isA3 ? 14 : 10;
  const colW = (width - gap * 2) / 3;
  const labels = ['Enfermeiro(a) responsável', 'Coordenador(a) da APS', 'Secretário(a) Municipal de Saúde'];
  const lineY = footerTop + (isA3 ? 8.5 : 7.5);
  labels.forEach((label, i) => {
    const lx = margin + i * (colW + gap);
    pdf.setDrawColor(120, 124, 128);
    pdf.setLineWidth(0.3);
    pdf.line(lx, lineY, lx + colW, lineY);
    setText(pdf, INK, isA3 ? 7.4 : 6.8);
    pdf.text(label, lx + colW / 2, lineY + (isA3 ? 3.6 : 3.2), { align: 'center' });
    setText(pdf, MUTED, isA3 ? 5.8 : 5.2);
    pdf.text('assinatura e carimbo', lx + colW / 2, lineY + (isA3 ? 6.6 : 5.9), { align: 'center' });
  });
}

async function drawMeta(
  pdf: jsPDF,
  l: Layout,
  input: OfficialMapPdfInput,
) {
  const { margin, pageW, metaTop, isA3 } = l;
  const { municipality, ubsList = [], homologation } = input;

  pdf.setDrawColor(RULE[0], RULE[1], RULE[2]);
  pdf.setLineWidth(0.3);
  pdf.line(margin, metaTop, pageW - margin, metaTop);

  // O QR leva ao próprio site (endereço de onde o PDF foi gerado), não a um servidor fixo.
  const qrUrl = window.location.origin;
  const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 0, width: 160 });
  const qrSize = isA3 ? 13 : 11.5;
  const qrX = pageW - margin - qrSize;
  pdf.addImage(qrDataUrl, 'PNG', qrX, metaTop + 2, qrSize, qrSize);
  setText(pdf, BRAND, isA3 ? 8 : 7.2, 'bold');
  pdf.text('SIGAPS', qrX - 2.5, metaTop + 6, { align: 'right' });
  setText(pdf, MUTED, isA3 ? 6.2 : 5.6);
  pdf.text('Aponte a câmera para abrir o sistema', qrX - 2.5, metaTop + 9.2, { align: 'right' });
  pdf.text(window.location.host, qrX - 2.5, metaTop + 12.2, { align: 'right' });

  const lh = isA3 ? 3.6 : 3.2;
  const size = isA3 ? 6.4 : 5.8;
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  setText(pdf, INK, size);
  pdf.text(`Gerado em ${dateStr}, às ${timeStr}`, margin, metaTop + 5);
  setText(pdf, MUTED, size);
  pdf.text('Mapa: © colaboradores do OpenStreetMap · ruas pintadas no SIGAPS', margin, metaTop + 5 + lh);
  pdf.text('Coordenadas: SIRGAS 2000 / WGS 84', margin, metaTop + 5 + lh * 2);

  const midX = margin + (isA3 ? 120 : 92);
  const midW = qrX - 60 - midX;
  setText(pdf, INK, size);
  pdf.text(
    truncate(
      pdf,
      homologation
        ? `Homologado em ${new Date(homologation.at).toLocaleDateString('pt-BR')} por ${homologation.by}`
        : `${municipality.secretariat} · ${municipality.name} — ${municipality.state}`,
      midW,
    ),
    midX,
    metaTop + 5,
  );
  setText(pdf, MUTED, size);
  if (ubsList.length > 0) {
    pdf.text(truncate(pdf, `UBS: ${ubsList.map((u) => u.name).join(' · ')}`, midW), midX, metaTop + 5 + lh);
  }
  if (homologation?.notes) {
    pdf.text(truncate(pdf, homologation.notes, midW), midX, metaTop + 5 + lh * 2);
  }
}

// ---------------------------------------------------------------------------
// Páginas seguintes: quadro completo, ruas divididas e ruas por microárea
// ---------------------------------------------------------------------------

type Flow = {
  pdf: jsPDF;
  isA3: boolean;
  margin: number;
  pageW: number;
  pageH: number;
  y: number;
  maxY: number;
};

function newAnnexPage(flow: Flow, title: string, subtitle?: string) {
  flow.pdf.addPage();
  const { pdf, margin, isA3 } = flow;
  setText(pdf, BRAND, isA3 ? 13 : 11, 'bold');
  pdf.text(title, margin, margin + 5);
  let y = margin + 5;
  if (subtitle) {
    setText(pdf, MUTED, isA3 ? 7.5 : 6.8);
    pdf.text(subtitle, margin, y + (isA3 ? 5 : 4.4));
    y += isA3 ? 5 : 4.4;
  }
  pdf.setDrawColor(BRAND[0], BRAND[1], BRAND[2]);
  pdf.setLineWidth(0.5);
  pdf.line(margin, y + 2.5, flow.pageW - margin, y + 2.5);
  flow.y = y + 8;
}

function sectionTitle(flow: Flow, title: string, continuing: string) {
  if (flow.y + 18 > flow.maxY) newAnnexPage(flow, continuing);
  const { pdf, margin, isA3 } = flow;
  setText(pdf, BRAND, isA3 ? 9.5 : 8.5, 'bold');
  pdf.text(title, margin, flow.y);
  flow.y += isA3 ? 4 : 3.5;
}

type Column = { title: string; width: number; align?: 'left' | 'right' };

function drawTable(
  flow: Flow,
  columns: Column[],
  rows: Array<{ swatch?: RGB; cells: string[]; boldFirst?: boolean }>,
  continuing: string,
) {
  const { pdf, margin, isA3 } = flow;
  const rowH = isA3 ? 5.6 : 5;
  const headH = isA3 ? 6.2 : 5.6;
  const width = flow.pageW - margin * 2;
  const swatchW = 7;
  const scale = (width - swatchW) / columns.reduce((s, c) => s + c.width, 0);

  const header = () => {
    pdf.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
    pdf.rect(margin, flow.y, width, headH, 'F');
    setText(pdf, [255, 255, 255], isA3 ? 7 : 6.4, 'bold');
    let cx = margin + swatchW;
    columns.forEach((c) => {
      const w = c.width * scale;
      if (c.align === 'right') pdf.text(c.title, cx + w - 2, flow.y + headH - 1.9, { align: 'right' });
      else pdf.text(c.title, cx, flow.y + headH - 1.9);
      cx += w;
    });
    flow.y += headH;
  };

  header();
  rows.forEach((row, i) => {
    if (flow.y + rowH > flow.maxY) {
      newAnnexPage(flow, continuing);
      header();
    }
    if (i % 2 === 1) {
      pdf.setFillColor(ZEBRA[0], ZEBRA[1], ZEBRA[2]);
      pdf.rect(margin, flow.y, width, rowH, 'F');
    }
    if (row.swatch) {
      pdf.setFillColor(row.swatch[0], row.swatch[1], row.swatch[2]);
      pdf.roundedRect(margin + 2, flow.y + 1.3, 4, rowH - 2.6, 0.6, 0.6, 'F');
    }
    let cx = margin + swatchW;
    row.cells.forEach((cell, ci) => {
      const c = columns[ci];
      const w = c.width * scale;
      setText(pdf, INK, isA3 ? 7 : 6.4, ci === 0 && row.boldFirst ? 'bold' : 'normal');
      const text = truncate(pdf, cell, w - 3);
      if (c.align === 'right') pdf.text(text, cx + w - 2, flow.y + rowH - 1.6, { align: 'right' });
      else pdf.text(text, cx, flow.y + rowH - 1.6);
      cx += w;
    });
    flow.y += rowH;
  });
  pdf.setDrawColor(RULE[0], RULE[1], RULE[2]);
  pdf.setLineWidth(0.3);
  pdf.line(margin, flow.y, margin + width, flow.y);
  flow.y += isA3 ? 8 : 7;
}

function microareaName(microareas: Microarea[], id?: string): string {
  return microareas.find((m) => m.id === id)?.name ?? '—';
}

/** "35 fam. · só lado esquerdo (direito: Microárea 02)" — o que ajuda a achar a rua no campo. */
function streetNote(street: Street, microareaId: string, microareas: Microarea[]): string {
  const parts: string[] = [];
  if ((street.familyCount ?? 0) > 0) parts.push(`${street.familyCount} fam.`);
  const a = getStreetSideAssignment(street);
  if (a.mode === 'SPLIT') {
    if (a.leftMicroareaId === microareaId && a.rightMicroareaId !== microareaId) {
      parts.push(
        a.rightMicroareaId
          ? `só lado esquerdo (direito: ${microareaName(microareas, a.rightMicroareaId)})`
          : 'só lado esquerdo',
      );
    } else if (a.rightMicroareaId === microareaId && a.leftMicroareaId !== microareaId) {
      parts.push(
        a.leftMicroareaId
          ? `só lado direito (esquerdo: ${microareaName(microareas, a.leftMicroareaId)})`
          : 'só lado direito',
      );
    }
  } else if (a.mode === 'NONE' && street.microareaId !== microareaId) {
    parts.push('trecho');
  }
  return parts.join(' · ');
}

function drawStreetLists(flow: Flow, rows: MicroareaRow[], microareas: Microarea[], continuing: string) {
  const { pdf, margin, isA3 } = flow;
  const width = flow.pageW - margin * 2;
  const cols = isA3 ? 3 : 2;
  const gap = 6;
  const colW = (width - gap * (cols - 1)) / cols;
  const lineH = isA3 ? 3.9 : 3.5;
  const barH = isA3 ? 6 : 5.4;
  const size = isA3 ? 7 : 6.4;

  for (const { microarea, streets, streetCount, familyCount } of rows) {
    const color = hexToRgb(microarea.color);
    let index = 0;
    let first = true;

    while (index < streets.length) {
      if (flow.y + barH + lineH * 2 > flow.maxY) newAnnexPage(flow, continuing);

      // Faixa com a cor da microárea
      pdf.setFillColor(color[0], color[1], color[2]);
      pdf.roundedRect(margin, flow.y, width, barH, 0.8, 0.8, 'F');
      setText(pdf, textOn(color), isA3 ? 8 : 7.2, 'bold');
      const head = [
        `${microarea.name.toUpperCase()}${first ? '' : ' (continuação)'}`,
        microarea.acs?.name ? `ACS: ${microarea.acs.name}` : null,
        microarea.ubs?.name ? `UBS: ${microarea.ubs.name}` : null,
        microarea.neighborhood?.name ? `Bairro: ${microarea.neighborhood.name}` : null,
      ]
        .filter(Boolean)
        .join('   ·   ');
      pdf.text(truncate(pdf, head, width - 50), margin + 2.5, flow.y + barH - 1.7);
      pdf.text(
        `${streetCount} ${streetCount === 1 ? 'rua' : 'ruas'}${familyCount > 0 ? ` · ${formatNumber(familyCount)} famílias` : ''}`,
        margin + width - 2.5,
        flow.y + barH - 1.7,
        { align: 'right' },
      );
      flow.y += barH + lineH;

      // Quantas linhas cabem nesta página; a lista corre de cima para baixo, coluna por coluna
      const rowsFit = Math.max(1, Math.floor((flow.maxY - flow.y) / lineH));
      const chunk = streets.slice(index, index + rowsFit * cols);
      const rowsInChunk = Math.ceil(chunk.length / cols);
      chunk.forEach((street, i) => {
        const col = Math.floor(i / rowsInChunk);
        const row = i % rowsInChunk;
        const x = margin + col * (colW + gap);
        const y = flow.y + row * lineH;
        const label = formatStreetLabel(street);
        const note = streetNote(street, microarea.id, microareas);
        setText(pdf, INK, size);
        const shownLabel = truncate(pdf, label, colW - (note ? 22 : 2));
        pdf.text(shownLabel, x, y);
        if (note) {
          const used = pdf.getTextWidth(`${shownLabel}  `);
          setText(pdf, MUTED, size - 0.6);
          pdf.text(truncate(pdf, note, colW - used - 1), x + used, y);
        }
      });
      index += chunk.length;
      flow.y += rowsInChunk * lineH + (isA3 ? 4 : 3.5);
      first = false;
    }
  }
}

// ---------------------------------------------------------------------------

export async function generateOfficialMapPdf(input: OfficialMapPdfInput): Promise<Blob> {
  const {
    format,
    mapImageDataUrl,
    mapImageWidth,
    mapImageHeight,
    mapMetersPerPixel,
    municipality,
    microareas,
    streets,
    neighborhoodName,
    includeSignatures = true,
  } = input;

  const rows = buildMicroareaRows(microareas, streets);
  const l = computeLayout(format, rows.length + 1, includeSignatures);
  const { isA3, pageW, pageH, margin, headerH } = l;

  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format });
  const docTitle = neighborhoodName
    ? `Mapa de microáreas — ${neighborhoodName}`
    : 'Mapa oficial de microáreas — APS';
  pdf.setProperties({
    title: `${docTitle} · ${municipality.name}/${municipality.state}`,
    subject: 'Territorialização da Atenção Primária à Saúde',
    author: municipality.secretariat,
    creator: 'SIGAPS',
  });

  const totalFamilies = streets.reduce((sum, s) => sum + (s.familyCount ?? 0), 0);
  const totalInhabitants = streets.reduce((sum, s) => sum + (s.inhabitantCount ?? 0), 0);
  const paintedStreets = streets.filter((s) => s.microareaId || (s.paintSegments?.length ?? 0) > 0).length;
  const coveragePct = streets.length > 0 ? Math.round((paintedStreets / streets.length) * 100) : 0;

  // Cabeçalho institucional
  pdf.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
  pdf.rect(0, 0, pageW, headerH, 'F');
  let titleX = margin;
  if (municipality.logoUrl) {
    const logo = await loadImageDataUrl(municipality.logoUrl);
    if (logo) {
      const logoSize = headerH - 7;
      try {
        pdf.addImage(logo, logo.includes('image/jpeg') ? 'JPEG' : 'PNG', margin, 3.5, logoSize, logoSize);
        titleX = margin + logoSize + 5;
      } catch {
        /* logo inválido: segue sem ele */
      }
    }
  }
  setText(pdf, [255, 255, 255], isA3 ? 17 : 14, 'bold');
  pdf.text(neighborhoodName ? `MAPA DE MICROÁREAS — ${neighborhoodName.toUpperCase()}` : 'MAPA OFICIAL DE MICROÁREAS — APS', titleX, headerH * 0.47);
  setText(pdf, [214, 232, 222], isA3 ? 10 : 8.6);
  pdf.text(`${municipality.name} — ${municipality.state}  ·  ${municipality.prefecture}`, titleX, headerH * 0.47 + (isA3 ? 7 : 5.8));

  const rightX = pageW - margin;
  setText(pdf, [255, 255, 255], isA3 ? 9.5 : 8.2, 'bold');
  pdf.text(municipality.secretariat, rightX, headerH * 0.32, { align: 'right' });
  setText(pdf, [214, 232, 222], isA3 ? 8.6 : 7.6);
  pdf.text(
    `Cobertura: ${coveragePct}% das ruas (${formatNumber(paintedStreets)} de ${formatNumber(streets.length)})`,
    rightX,
    headerH * 0.32 + (isA3 ? 5 : 4.3),
    { align: 'right' },
  );
  if (totalFamilies > 0) {
    pdf.text(
      `${formatNumber(totalFamilies)} famílias · ${formatNumber(totalInhabitants)} habitantes`,
      rightX,
      headerH * 0.32 + (isA3 ? 10 : 8.6),
      { align: 'right' },
    );
  }

  // Mapa (limpo: nada desenhado por cima)
  const { srcW } = await drawCoverImage(pdf, mapImageDataUrl, l.mapX, l.mapY, l.mapW, l.mapH, mapImageWidth, mapImageHeight);
  pdf.setDrawColor(150, 156, 160);
  pdf.setLineWidth(0.35);
  pdf.rect(l.mapX, l.mapY, l.mapW, l.mapH, 'S');
  const metersPerMm = mapMetersPerPixel && srcW > 0 ? (mapMetersPerPixel * srcW) / l.mapW : null;

  if (rows.length > 0) {
    drawLegendStrip(pdf, l, rows, metersPerMm);
  } else {
    setText(pdf, MUTED, isA3 ? 8 : 7.2, 'italic');
    pdf.text('Nenhuma rua pintada ainda: pinte as ruas das microáreas no mapa.', l.mapX, l.stripY + 4);
    const northSize = isA3 ? 11 : 9.5;
    drawNorthArrow(pdf, l.mapX + l.mapW - northSize, l.stripY + 1.5, northSize);
  }

  if (includeSignatures) drawSignatureRow(pdf, l);
  await drawMeta(pdf, l, input);

  // Anexos
  if (rows.length > 0) {
    const flow: Flow = { pdf, isA3, margin, pageW, pageH, y: 0, maxY: pageH - margin - 4 };
    const place = `${municipality.name} — ${municipality.state}${neighborhoodName ? ` · ${neighborhoodName}` : ''}`;
    newAnnexPage(flow, 'QUADRO DE MICROÁREAS', `${place} · ${rows.length} microáreas com ruas pintadas`);

    drawTable(
      flow,
      [
        { title: 'MICROÁREA', width: 16 },
        { title: 'ACS', width: 26 },
        { title: 'UBS', width: 20 },
        { title: 'BAIRRO', width: 18 },
        { title: 'RUAS', width: 7, align: 'right' },
        { title: 'FAMÍLIAS', width: 9, align: 'right' },
        { title: 'HABITANTES', width: 10, align: 'right' },
      ],
      rows.map((r) => ({
        swatch: hexToRgb(r.microarea.color),
        boldFirst: true,
        cells: [
          r.microarea.name,
          r.microarea.acs?.name ?? '—',
          r.microarea.ubs?.name ?? '—',
          r.microarea.neighborhood?.name ?? '—',
          formatNumber(r.streetCount),
          r.familyCount > 0 ? formatNumber(r.familyCount) : '—',
          r.inhabitantCount > 0 ? formatNumber(r.inhabitantCount) : '—',
        ],
      })),
      'QUADRO DE MICROÁREAS (continuação)',
    );

    const divided = streets
      .filter((s) => getStreetSideAssignment(s).mode === 'SPLIT')
      .sort((a, b) => formatStreetLabel(a).localeCompare(formatStreetLabel(b), 'pt-BR'));
    if (divided.length > 0) {
      sectionTitle(flow, 'RUAS DIVIDIDAS ENTRE MICROÁREAS', 'RUAS DIVIDIDAS (continuação)');
      drawTable(
        flow,
        [
          { title: 'RUA', width: 30 },
          { title: 'LADO DIREITO', width: 22 },
          { title: 'LADO ESQUERDO', width: 22 },
          { title: 'FAMÍLIAS', width: 8, align: 'right' },
        ],
        divided.map((s) => {
          const a = getStreetSideAssignment(s);
          return {
            cells: [
              formatStreetLabel(s),
              microareaName(microareas, a.rightMicroareaId),
              microareaName(microareas, a.leftMicroareaId),
              (s.familyCount ?? 0) > 0 ? formatNumber(s.familyCount ?? 0) : '—',
            ],
          };
        }),
        'RUAS DIVIDIDAS (continuação)',
      );
    }

    // Continua na mesma folha se couber (não deixa página quase vazia)
    sectionTitle(flow, 'RUAS POR MICROÁREA', 'RUAS POR MICROÁREA (continuação)');
    setText(pdf, MUTED, isA3 ? 7 : 6.4);
    pdf.text('Em ordem alfabética · "fam." = famílias cadastradas na rua', margin, flow.y + 0.5);
    flow.y += isA3 ? 5 : 4.5;
    drawStreetLists(flow, rows, microareas, 'RUAS POR MICROÁREA (continuação)');
  }

  // Rodapé de todas as páginas
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    setText(pdf, MUTED, isA3 ? 6.5 : 5.8);
    pdf.text(`SIGAPS · ${docTitle} · ${municipality.name} — ${municipality.state}`, margin, pageH - 4);
    pdf.text(`Página ${i} de ${pages}`, pageW - margin, pageH - 4, { align: 'right' });
  }

  return pdf.output('blob');
}

export function downloadPdfBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function openPdfBlob(blob: Blob): string {
  return URL.createObjectURL(blob);
}
