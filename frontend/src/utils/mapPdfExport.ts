import type { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { Microarea, Street } from '../services/api';
import { formatStreetLabel } from './streetSearch';

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

type MicroareaRow = {
  microarea: Microarea;
  streetCount: number;
  familyCount: number;
  inhabitantCount: number;
};

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

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Preenche a área (crop central se necessário) — sem faixas vazias. */
function drawCoverImage(
  pdf: jsPDF,
  dataUrl: string,
  x: number,
  y: number,
  boxW: number,
  boxH: number,
  imgW: number,
  imgH: number,
) {
  if (imgW <= 0 || imgH <= 0) {
    pdf.addImage(dataUrl, 'PNG', x, y, boxW, boxH);
    return;
  }
  const imgRatio = imgW / imgH;
  const boxRatio = boxW / boxH;
  let sx = 0;
  let sy = 0;
  let sw = imgW;
  let sh = imgH;

  if (imgRatio > boxRatio) {
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
    return;
  }

  const img = new Image();
  img.src = dataUrl;
  return new Promise<void>((resolve) => {
    img.onload = () => {
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const cropped = canvas.toDataURL('image/png', 0.95);
      pdf.addImage(cropped, 'PNG', x, y, boxW, boxH);
      resolve();
    };
    img.onerror = () => {
      pdf.addImage(dataUrl, 'PNG', x, y, boxW, boxH);
      resolve();
    };
  });
}

function drawScaleBar(pdf: jsPDF, x: number, y: number, widthMm: number) {
  const h = 3;
  const seg = widthMm / 4;
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(50);
  pdf.setLineWidth(0.35);
  pdf.roundedRect(x - 1, y - 1, widthMm + 2, h + 7, 1, 1, 'FD');

  for (let i = 0; i < 4; i++) {
    if (i % 2 === 0) pdf.setFillColor(30, 30, 30);
    else pdf.setFillColor(255, 255, 255);
    pdf.rect(x + seg * i, y, seg, h, 'F');
  }
  pdf.setDrawColor(30);
  pdf.rect(x, y, widthMm, h, 'S');

  pdf.setFontSize(6);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(40);
  pdf.text('0', x - 0.5, y + h + 4);
  pdf.text('125 m', x + seg - 4, y + h + 4);
  pdf.text('250 m', x + seg * 2 - 4, y + h + 4);
  pdf.text('500 m', x + seg * 3 - 5, y + h + 4);
}

function drawCompassRose(pdf: jsPDF, x: number, y: number, size: number) {
  const cx = x + size / 2;
  const cy = y + size / 2;

  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(60, 60, 60);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(x, y, size, size, 1.5, 1.5, 'FD');

  pdf.setFillColor(190, 45, 45);
  pdf.triangle(cx, y + 2.5, cx - 3, cy, cx + 3, cy, 'F');
  pdf.setFillColor(170, 170, 170);
  pdf.triangle(cx, y + size - 2.5, cx - 3, cy, cx + 3, cy, 'F');

  pdf.setDrawColor(100);
  pdf.line(cx, y + 3, cx, y + size - 3);
  pdf.line(x + 3, cy, x + size - 3, cy);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(190, 45, 45);
  pdf.text('N', cx - 1.6, y + 7);
  pdf.setTextColor(80);
  pdf.text('S', cx - 1.5, y + size - 2);
  pdf.text('L', x + 3, cy + 2);
  pdf.text('O', x + size - 5.5, cy + 2);
}

function drawMapInsetLegend(
  pdf: jsPDF,
  x: number,
  y: number,
  rows: MicroareaRow[],
  isA3: boolean,
) {
  const maxItems = Math.min(rows.length, isA3 ? 6 : 5);
  if (maxItems === 0) return;
  const lineH = isA3 ? 4 : 3.6;
  const boxH = maxItems * lineH + 6;
  const boxW = isA3 ? 52 : 46;

  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(180);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(x, y, boxW, boxH, 1.5, 1.5, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(isA3 ? 6.5 : 6);
  pdf.setTextColor(15, 61, 46);
  pdf.text('LEGENDA', x + 2.5, y + 4);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(isA3 ? 6 : 5.5);
  let ly = y + 7.5;
  for (let i = 0; i < maxItems; i++) {
    const { microarea, streetCount } = rows[i];
    const [r, g, b] = hexToRgb(microarea.color);
    pdf.setFillColor(r, g, b);
    pdf.rect(x + 2.5, ly - 2.2, 4, 2.8, 'F');
    pdf.setTextColor(35, 35, 35);
    pdf.text(truncate(pdf, `${microarea.name} (${streetCount})`, boxW - 10), x + 8, ly);
    ly += lineH;
  }
}

function drawHomologationStamp(
  pdf: jsPDF,
  x: number,
  y: number,
  homologation: NonNullable<OfficialMapPdfInput['homologation']>,
  isA3: boolean,
) {
  const w = isA3 ? 58 : 50;
  const h = isA3 ? 22 : 18;
  pdf.setDrawColor(22, 120, 66);
  pdf.setLineWidth(1.2);
  pdf.roundedRect(x, y, w, h, 2, 2, 'S');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(isA3 ? 11 : 9);
  pdf.setTextColor(22, 120, 66);
  pdf.text('HOMOLOGADO', x + 4, y + 8);
  pdf.setFontSize(isA3 ? 8 : 7);
  pdf.text('SMS / APS', x + 4, y + 13);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(isA3 ? 6 : 5.5);
  pdf.setTextColor(60);
  const dateStr = new Date(homologation.at).toLocaleDateString('pt-BR');
  pdf.text(dateStr, x + 4, y + 17);
  if (homologation.by) {
    pdf.text(truncate(pdf, homologation.by, w - 6), x + 4, y + (isA3 ? 20.5 : 16.5));
  }
}

function drawSignatureRow(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  isA3: boolean,
) {
  const colW = (width - 8) / 3;
  const labels = [
    'Enfermeiro(a) responsável',
    'Coordenador(a) APS',
    'Secretário(a) de Saúde',
  ];
  labels.forEach((label, i) => {
    const lx = x + i * (colW + 4);
    pdf.setDrawColor(160);
    pdf.setLineWidth(0.35);
    pdf.line(lx, y + 10, lx + colW, y + 10);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(isA3 ? 7 : 6.5);
    pdf.setTextColor(50);
    pdf.text(label, lx + colW / 2, y + 13.5, { align: 'center' });
    pdf.setFontSize(isA3 ? 6 : 5.5);
    pdf.setTextColor(130);
    pdf.text('Assinatura e carimbo', lx + colW / 2, y + 8, { align: 'center' });
  });
}

function buildMicroareaRows(microareas: Microarea[], streets: Street[]): MicroareaRow[] {
  return microareas
    .map((microarea) => {
      const maStreets = streets.filter((s) => s.microareaId === microarea.id);
      return {
        microarea,
        streetCount: maStreets.length,
        familyCount: maStreets.reduce((sum, s) => sum + (s.familyCount ?? 0), 0),
        inhabitantCount: maStreets.reduce((sum, s) => sum + (s.inhabitantCount ?? 0), 0),
      };
    })
    .filter((row) => row.streetCount > 0)
    .sort((a, b) => a.microarea.number - b.microarea.number);
}

function truncate(pdf: jsPDF, text: string, maxW: number): string {
  if (pdf.getTextWidth(text) <= maxW) return text;
  let out = text;
  while (out.length > 1 && pdf.getTextWidth(`${out}…`) > maxW) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

function drawLegendTable(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  rows: MicroareaRow[],
  isA3: boolean,
) {
  const rowH = isA3 ? 5.5 : 5;
  const headerH = isA3 ? 7 : 6;
  const cols = {
    swatch: 8,
    name: width * 0.22,
    acs: width * 0.24,
    ubs: width * 0.2,
    streets: width * 0.1,
    families: width * 0.14,
  };

  pdf.setFillColor(15, 61, 46);
  pdf.rect(x, y, width, headerH, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(isA3 ? 7.5 : 7);

  let cx = x + 2;
  pdf.text('', cx, y + 4.5);
  cx += cols.swatch;
  pdf.text('MICROÁREA', cx, y + 4.5);
  cx += cols.name;
  pdf.text('ACS', cx, y + 4.5);
  cx += cols.acs;
  pdf.text('UBS', cx, y + 4.5);
  cx += cols.ubs;
  pdf.text('RUAS', cx, y + 4.5);
  cx += cols.streets;
  pdf.text('FAM./HAB.', cx, y + 4.5);

  let rowY = y + headerH;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(isA3 ? 7 : 6.5);

  for (let i = 0; i < rows.length; i++) {
    const { microarea, streetCount, familyCount, inhabitantCount } = rows[i];
    const bg = i % 2 === 0 ? [252, 252, 252] : [245, 247, 250];
    pdf.setFillColor(bg[0], bg[1], bg[2]);
    pdf.rect(x, rowY, width, rowH, 'F');

    const [r, g, b] = hexToRgb(microarea.color);
    pdf.setFillColor(r, g, b);
    pdf.setDrawColor(255, 255, 255);
    pdf.setLineWidth(0.25);
    pdf.rect(x + 2.5, rowY + 1.2, 4.5, rowH - 2.4, 'FD');

    cx = x + cols.swatch;
    pdf.setTextColor(25, 25, 25);
    pdf.setFont('helvetica', 'bold');
    pdf.text(truncate(pdf, microarea.name, cols.name - 2), cx, rowY + 3.8);
    cx += cols.name;
    pdf.setFont('helvetica', 'normal');
    pdf.text(
      truncate(pdf, microarea.acs?.name ?? '—', cols.acs - 2),
      cx,
      rowY + 3.8,
    );
    cx += cols.acs;
    pdf.text(
      truncate(pdf, microarea.ubs?.name ?? '—', cols.ubs - 2),
      cx,
      rowY + 3.8,
    );
    cx += cols.ubs;
    pdf.text(String(streetCount), cx, rowY + 3.8);
    cx += cols.streets;
    pdf.text(
      familyCount > 0 ? `${familyCount} / ${inhabitantCount}` : '—',
      cx,
      rowY + 3.8,
    );

    rowY += rowH;
  }

  pdf.setDrawColor(200);
  pdf.setLineWidth(0.3);
  pdf.rect(x, y, width, rowY - y, 'S');

  return rowY;
}

export async function generateOfficialMapPdf(input: OfficialMapPdfInput): Promise<Blob> {
  const {
    format,
    mapImageDataUrl,
    mapImageWidth,
    mapImageHeight,
    municipality,
    microareas,
    streets,
    neighborhoodName,
    ubsList = [],
    includeSignatures = true,
    homologation,
  } = input;

  const isA3 = format === 'a3';
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = isA3 ? 12 : 10;
  const headerH = isA3 ? 28 : 24;
  const signatureH = includeSignatures ? (isA3 ? 18 : 16) : 0;
  const footerH = (isA3 ? 16 : 14) + signatureH;

  const rows = buildMicroareaRows(microareas, streets);
  const totalFamilies = streets.reduce((sum, s) => sum + (s.familyCount ?? 0), 0);
  const totalInhabitants = streets.reduce((sum, s) => sum + (s.inhabitantCount ?? 0), 0);
  const paintedStreets = streets.filter((s) => s.microareaId).length;
  const coveragePct =
    streets.length > 0 ? Math.round((paintedStreets / streets.length) * 100) : 0;

  const legendRowsOnPage = Math.min(rows.length, isA3 ? 8 : 6);
  const legendH = (isA3 ? 7 : 6) + Math.max(legendRowsOnPage, 1) * (isA3 ? 5.5 : 5) + 4;
  const contentTop = margin + headerH + 2;
  const contentBottom = pageH - margin - footerH;
  const mapH = contentBottom - contentTop - legendH - 3;
  const mapW = pageW - margin * 2;
  const mapX = margin;
  const mapY = contentTop;

  // Cabeçalho institucional
  pdf.setFillColor(15, 61, 46);
  pdf.rect(0, 0, pageW, headerH + margin * 0.4, 'F');

  const logoSize = isA3 ? 22 : 18;
  if (municipality.logoUrl) {
    const logo = await loadImageDataUrl(municipality.logoUrl);
    if (logo) {
      try {
        const fmt = logo.includes('image/jpeg') ? 'JPEG' : 'PNG';
        pdf.addImage(logo, fmt, margin, margin * 0.55, logoSize, logoSize);
      } catch {
        /* ignore */
      }
    }
  }

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(isA3 ? 17 : 14);
  const titleX = margin + logoSize + 5;
  const title = neighborhoodName
    ? `MAPA DE MICROÁREAS — ${neighborhoodName.toUpperCase()}`
    : 'MAPA OFICIAL DE MICROÁREAS — APS';
  pdf.text(title, titleX, isA3 ? 14 : 12);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(isA3 ? 10 : 9);
  pdf.text(`${municipality.name} — ${municipality.state}`, titleX, isA3 ? 21 : 18);
  pdf.text(municipality.prefecture, titleX, isA3 ? 27 : 23);

  const rightX = pageW - margin - 72;
  pdf.setFontSize(isA3 ? 9 : 8);
  pdf.text(municipality.secretariat, rightX, isA3 ? 14 : 12);
  pdf.text(
    `Cobertura: ${coveragePct}% (${paintedStreets}/${streets.length} ruas)`,
    rightX,
    isA3 ? 20 : 17,
  );
  if (totalFamilies > 0) {
    pdf.text(
      `${totalFamilies.toLocaleString('pt-BR')} famílias · ${totalInhabitants.toLocaleString('pt-BR')} habitantes`,
      rightX,
      isA3 ? 26 : 22,
    );
  }

  // Moldura do mapa
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(180, 180, 180);
  pdf.setLineWidth(0.6);
  pdf.rect(mapX, mapY, mapW, mapH, 'FD');
  pdf.setLineWidth(0.25);
  pdf.setDrawColor(220, 220, 220);
  pdf.rect(mapX + 1.5, mapY + 1.5, mapW - 3, mapH - 3, 'S');

  await drawCoverImage(
    pdf,
    mapImageDataUrl,
    mapX + 2,
    mapY + 2,
    mapW - 4,
    mapH - 4,
    mapImageWidth,
    mapImageHeight,
  );

  const compassSize = isA3 ? 18 : 14;
  drawCompassRose(pdf, mapX + mapW - compassSize - 5, mapY + mapH - compassSize - 5, compassSize);
  drawScaleBar(pdf, mapX + 5, mapY + mapH - (isA3 ? 16 : 13), isA3 ? 36 : 30);
  if (rows.length > 0) {
    drawMapInsetLegend(pdf, mapX + 5, mapY + 5, rows, isA3);
  }
  if (homologation) {
    drawHomologationStamp(
      pdf,
      mapX + mapW - (isA3 ? 64 : 56),
      mapY + 5,
      homologation,
      isA3,
    );
  }

  // Legenda horizontal (estilo mapa oficial)
  const legendY = mapY + mapH + 3;
  pdf.setTextColor(15, 61, 46);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(isA3 ? 9 : 8);
  pdf.text('LEGENDA E QUADRO DE MICROÁREAS', margin, legendY + 4);

  const tableY = legendY + 6;
  if (rows.length > 0) {
    const pageRows = rows.slice(0, legendRowsOnPage);
    drawLegendTable(pdf, margin, tableY, mapW, pageRows, isA3);
    if (rows.length > legendRowsOnPage) {
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(6.5);
      pdf.setTextColor(100);
      const moreY = tableY + (isA3 ? 7 : 6) + pageRows.length * (isA3 ? 5.5 : 5) + 1;
      pdf.text(
        `+ ${rows.length - legendRowsOnPage} microárea(s) no detalhamento das páginas seguintes`,
        margin + 2,
        moreY,
      );
    }
  } else {
    pdf.setFillColor(250, 250, 250);
    pdf.setDrawColor(210);
    pdf.rect(margin, tableY, mapW, 12, 'FD');
    pdf.setTextColor(120);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
    pdf.text('Nenhuma rua pintada — vincule ruas às microáreas antes de homologar o mapa.', margin + 3, tableY + 7);
  }

  // Rodapé
  const footY = pageH - margin - footerH + 3;
  if (includeSignatures) {
    drawSignatureRow(pdf, margin, footY - 1, pageW - margin * 2, isA3);
  }
  const metaY = footY + (includeSignatures ? signatureH - 2 : 0);
  pdf.setDrawColor(200);
  pdf.setLineWidth(0.35);
  pdf.line(margin, metaY - 2, pageW - margin, metaY - 2);

  const qrUrl = 'https://sigaps-api.onrender.com';
  const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: 120 });
  const qrSize = isA3 ? 14 : 12;
  pdf.addImage(qrDataUrl, 'PNG', pageW - margin - qrSize, metaY - 1, qrSize, qrSize);

  pdf.setFontSize(6);
  pdf.setTextColor(60);
  pdf.setFont('helvetica', 'normal');
  const dateStr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  pdf.text(`Gerado em ${dateStr}`, margin, metaY + 4);
  pdf.text('SIRGAS 2000 / WGS84 · Esri World Imagery / OpenStreetMap', margin, metaY + 8);
  pdf.text(
    homologation
      ? `Homologado em ${new Date(homologation.at).toLocaleDateString('pt-BR')} por ${homologation.by}`
      : 'Documento para homologação pela Secretaria Municipal de Saúde',
    margin + 78,
    metaY + 4,
  );
  pdf.setFont('helvetica', 'bold');
  pdf.text('SIGAPS', pageW - margin - qrSize, metaY + qrSize + 3);

  if (ubsList.length > 0) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(5.5);
    pdf.setTextColor(90);
    const ubsLine = ubsList
      .slice(0, 3)
      .map((u) => u.name)
      .join(' · ');
    pdf.text(`UBS: ${ubsLine}`, margin + 78, metaY + 8);
  }
  if (homologation?.notes) {
    pdf.setFontSize(5.5);
    pdf.setTextColor(80);
    pdf.text(truncate(pdf, homologation.notes, pageW - margin * 2 - 40), margin, metaY + 12);
  }

  // Anexo com listagem de ruas (páginas seguintes)
  if (rows.length > 0) {
    pdf.addPage();
    let annexY = margin + 10;
    const contentW = pageW - margin * 2;
    const maxY = pageH - margin - 10;
    const lineH = isA3 ? 3.8 : 3.4;

    pdf.setTextColor(15, 61, 46);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(isA3 ? 12 : 10);
    pdf.text('DETALHAMENTO DE RUAS POR MICROÁREA', margin, annexY);
    annexY += 8;

    for (const { microarea, streetCount } of rows) {
      const maStreets = streets.filter((s) => s.microareaId === microarea.id);
      const blockH = 8 + Math.min(maStreets.length, 12) * lineH;
      if (annexY + blockH > maxY) {
        pdf.addPage();
        annexY = margin + 10;
      }

      const [r, g, b] = hexToRgb(microarea.color);
      pdf.setFillColor(r, g, b);
      pdf.rect(margin, annexY - 3.5, contentW, 5.5, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(isA3 ? 8.5 : 7.5);
      const headerLine = [
        microarea.name.toUpperCase(),
        microarea.acs?.name ? `ACS: ${microarea.acs.name}` : null,
        microarea.ubs?.name ? `UBS: ${microarea.ubs.name}` : null,
        microarea.neighborhood?.name ? `Bairro: ${microarea.neighborhood.name}` : null,
        `${streetCount} ruas`,
      ]
        .filter(Boolean)
        .join('  ·  ');
      pdf.text(truncate(pdf, headerLine, contentW - 4), margin + 2, annexY);
      annexY += 5;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(isA3 ? 7 : 6.5);
      pdf.setTextColor(45, 45, 45);

      const colW = contentW / 2 - 2;
      maStreets.slice(0, 24).forEach((street, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const x = margin + col * (colW + 4);
        const y = annexY + row * lineH;
        if (y > maxY - 4) return;
        const families = street.familyCount ?? 0;
        const suffix = families > 0 ? ` (${families} fam.)` : '';
        pdf.text(`• ${formatStreetLabel(street)}${suffix}`, x, y);
      });

      const listed = Math.min(maStreets.length, 24);
      annexY += Math.max(1, Math.ceil(listed / 2)) * lineH + 2;
      const extra = maStreets.length - 24;
      if (extra > 0) {
        pdf.setTextColor(110);
        pdf.text(`… e mais ${extra} rua(s)`, margin, annexY);
        annexY += 4;
      }
      annexY += 3;
    }
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
