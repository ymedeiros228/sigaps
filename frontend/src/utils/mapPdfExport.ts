import { jsPDF } from 'jspdf';
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
}

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

function fitImageInBox(
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number,
): { offsetX: number; offsetY: number; drawW: number; drawH: number } {
  if (imgW <= 0 || imgH <= 0) {
    return { offsetX: 0, offsetY: 0, drawW: boxW, drawH: boxH };
  }
  const imgRatio = imgW / imgH;
  const boxRatio = boxW / boxH;
  if (imgRatio > boxRatio) {
    const drawW = boxW;
    const drawH = boxW / imgRatio;
    return { offsetX: 0, offsetY: (boxH - drawH) / 2, drawW, drawH };
  }
  const drawH = boxH;
  const drawW = boxH * imgRatio;
  return { offsetX: (boxW - drawW) / 2, offsetY: 0, drawW, drawH };
}

function drawCompassRose(pdf: jsPDF, x: number, y: number, size: number) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2 - 1;

  pdf.setDrawColor(40);
  pdf.setLineWidth(0.35);
  pdf.circle(cx, cy, r, 'S');

  // Seta norte
  pdf.setFillColor(200, 40, 40);
  pdf.line(cx, y + 2, cx - 2.5, cy);
  pdf.line(cx, y + 2, cx + 2.5, cy);
  pdf.line(cx - 2.5, cy, cx + 2.5, cy);
  pdf.line(cx, y + 2, cx, cy);

  // Seta sul
  pdf.setDrawColor(120);
  pdf.line(cx, y + size - 2, cx, cy);

  pdf.line(cx, y + 3, cx, y + size - 3);
  pdf.line(x + 3, cy, x + size - 3, cy);

  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(180, 30, 30);
  pdf.text('N', cx - 1.8, y + 6);
  pdf.setTextColor(80);
  pdf.text('S', cx - 1.5, y + size - 2);
  pdf.text('L', x + 2, cy + 2);
  pdf.text('O', x + size - 5, cy + 2);
}

function drawScaleBar(pdf: jsPDF, x: number, y: number, segmentMm: number) {
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.4);
  pdf.setFillColor(0, 0, 0);
  pdf.rect(x, y, segmentMm, 2.5, 'F');
  pdf.setFillColor(255, 255, 255);
  pdf.rect(x + segmentMm, y, segmentMm, 2.5, 'F');
  pdf.rect(x + segmentMm * 2, y, segmentMm, 2.5, 'S');
  pdf.setFontSize(6.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(30);
  pdf.text('0', x - 0.5, y + 5.5);
  pdf.text('250 m', x + segmentMm - 3, y + 5.5);
  pdf.text('500 m', x + segmentMm * 2 - 3, y + 5.5);
  pdf.setFontSize(5.5);
  pdf.setTextColor(90);
  pdf.text('Escala gráfica aproximada', x, y + 9);
}

function drawSidebarLegend(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  microareas: Microarea[],
  streets: Street[],
) {
  pdf.setFillColor(245, 247, 250);
  pdf.setDrawColor(210, 210, 210);
  pdf.rect(x, y, width, 42, 'FD');

  pdf.setTextColor(30, 30, 30);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('LEGENDA', x + 3, y + 6);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  let rowY = y + 11;
  const legendItems = microareas.length > 0
    ? microareas
    : [{ id: '0', name: 'Sem microárea', color: '#888888' } as Microarea];

  for (const ma of legendItems) {
    const count = streets.filter((s) => s.microareaId === ma.id).length;
    const [r, g, b] = hexToRgb(ma.color);
    pdf.setFillColor(r, g, b);
    pdf.rect(x + 3, rowY - 2.5, 5, 3, 'F');
    pdf.setTextColor(40, 40, 40);
    pdf.text(`${ma.name}${count > 0 ? ` (${count})` : ''}`, x + 10, rowY);
    rowY += 4.5;
    if (rowY > y + 38) break;
  }

  pdf.setTextColor(100, 100, 100);
  pdf.setFontSize(6);
  pdf.text('— Estrada de terra', x + 10, y + 38);
  pdf.setFillColor(196, 163, 90);
  pdf.rect(x + 3, y + 35.5, 5, 3, 'F');
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
  } = input;

  const isA3 = format === 'a3';
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = isA3 ? 10 : 8;
  const headerH = isA3 ? 26 : 22;
  const footerH = isA3 ? 18 : 16;

  const contentTop = margin + headerH;
  const contentBottom = pageH - margin - footerH;
  const contentH = contentBottom - contentTop;
  const mapRatio = isA3 ? 0.62 : 0.58;
  const mapW = pageW * mapRatio - margin;
  const sideW = pageW - mapW - margin * 3;
  const sideX = margin + mapW + margin;

  const totalFamilies = streets.reduce((sum, s) => sum + (s.familyCount ?? 0), 0);
  const totalInhabitants = streets.reduce((sum, s) => sum + (s.inhabitantCount ?? 0), 0);

  pdf.setFillColor(15, 61, 46);
  pdf.rect(0, 0, pageW, headerH + margin, 'F');

  const logoSize = isA3 ? 20 : 16;
  if (municipality.logoUrl) {
    const logo = await loadImageDataUrl(municipality.logoUrl);
    if (logo) {
      try {
        const fmt = logo.includes('image/jpeg') ? 'JPEG' : 'PNG';
        pdf.addImage(logo, fmt, margin, isA3 ? 5 : 4, logoSize, logoSize);
      } catch {
        /* ignore */
      }
    }
  }

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(isA3 ? 16 : 14);
  const title = neighborhoodName
    ? `MAPA DE MICROÁREAS — ${neighborhoodName.toUpperCase()}`
    : 'MAPA OFICIAL DE MICROÁREAS — APS';
  pdf.text(title, margin + logoSize + 4, isA3 ? 13 : 12);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(isA3 ? 10 : 9);
  pdf.text(`${municipality.name} — ${municipality.state}`, margin + logoSize + 4, isA3 ? 20 : 18);
  pdf.text(municipality.secretariat, pageW - margin - 70, isA3 ? 13 : 12);
  pdf.text(municipality.prefecture, pageW - margin - 70, isA3 ? 20 : 18);
  if (totalFamilies > 0) {
    pdf.setFontSize(8);
    pdf.text(
      `${totalFamilies.toLocaleString('pt-BR')} famílias · ${totalInhabitants.toLocaleString('pt-BR')} habitantes`,
      pageW - margin - 70,
      isA3 ? 25 : 22,
    );
  }

  pdf.setDrawColor(200);
  pdf.setLineWidth(0.5);
  pdf.rect(margin, contentTop, mapW, contentH);

  const { offsetX, offsetY, drawW, drawH } = fitImageInBox(
    mapImageWidth,
    mapImageHeight,
    mapW - 1,
    contentH - 1,
  );
  pdf.addImage(
    mapImageDataUrl,
    'PNG',
    margin + 0.5 + offsetX,
    contentTop + 0.5 + offsetY,
    drawW,
    drawH,
  );

  drawSidebarLegend(pdf, sideX, contentTop, sideW, microareas, streets);

  if (ubsList.length > 0) {
    const ubsY = contentTop + 46;
    pdf.setTextColor(30, 30, 30);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text('UNIDADES BÁSICAS DE SAÚDE', sideX, ubsY);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.5);
    let uy = ubsY + 4;
    for (const ubs of ubsList.slice(0, 4)) {
      pdf.text(`• ${ubs.name}`, sideX + 1, uy);
      uy += 3.5;
      if (uy > contentTop + 58) break;
    }
  }

  let sideY = contentTop + (ubsList.length > 0 ? 62 : 46);
  const cardH = 26;
  const gap = 3;
  const activeMicroareas = microareas.filter((m) =>
    streets.some((s) => s.microareaId === m.id),
  );

  pdf.setTextColor(30, 30, 30);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('DETALHES POR MICROÁREA', sideX, sideY);
  sideY += 5;

  for (const ma of activeMicroareas) {
    if (sideY + cardH > contentBottom) {
      pdf.addPage();
      sideY = margin + 8;
    }

    const [r, g, b] = hexToRgb(ma.color);
    pdf.setFillColor(r, g, b);
    pdf.rect(sideX, sideY, sideW, 4, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text(ma.name.toUpperCase(), sideX + 2, sideY + 2.8);

    pdf.setDrawColor(220);
    pdf.setFillColor(250, 250, 250);
    pdf.rect(sideX, sideY + 4, sideW, cardH - 4, 'FD');

    pdf.setTextColor(50, 50, 50);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.5);
    pdf.text(`ACS: ${ma.acs?.name ?? '—'}`, sideX + 2, sideY + 9);

    pdf.setFont('helvetica', 'normal');
    const maStreets = streets.filter((s) => s.microareaId === ma.id);
    const maFamilies = maStreets.reduce((sum, s) => sum + (s.familyCount ?? 0), 0);
    const maInhabitants = maStreets.reduce((sum, s) => sum + (s.inhabitantCount ?? 0), 0);
    const streetLabels = maStreets.map((s) => formatStreetLabel(s)).slice(0, 5);

    if (maFamilies > 0) {
      pdf.text(
        `Famílias: ${maFamilies} · Habitantes: ${maInhabitants}`,
        sideX + 2,
        sideY + 13,
      );
    }

    pdf.text('Ruas:', sideX + 2, sideY + (maFamilies > 0 ? 17 : 13));
    streetLabels.forEach((name, i) => {
      pdf.text(`• ${name}`, sideX + 3, sideY + (maFamilies > 0 ? 20 : 16) + i * 3);
    });
    const total = maStreets.length;
    if (total > 5) {
      pdf.text(
        `... +${total - 5} rua(s)`,
        sideX + 3,
        sideY + (maFamilies > 0 ? 20 : 16) + 5 * 3,
      );
    }

    sideY += cardH + gap;
  }

  if (activeMicroareas.length === 0) {
    pdf.setTextColor(120);
    pdf.setFontSize(8);
    pdf.text('Nenhuma rua pintada ainda.', sideX, sideY + 6);
  }

  const footY = pageH - margin - footerH + 2;
  pdf.setDrawColor(200);
  pdf.line(margin, footY - 2, pageW - margin, footY - 2);

  drawScaleBar(pdf, margin + mapW * 0.25, footY + 1, isA3 ? 18 : 15);
  drawCompassRose(pdf, margin + mapW * 0.52, footY - 1, isA3 ? 16 : 12);

  const qrUrl = 'https://sigaps-api.onrender.com';
  const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: 100 });
  pdf.addImage(qrDataUrl, 'PNG', pageW - margin - 18, footY - 1, isA3 ? 16 : 14, isA3 ? 16 : 14);
  pdf.setFontSize(5.5);
  pdf.setTextColor(40, 40, 40);
  pdf.text('SIGAPS', pageW - margin - 18, footY + (isA3 ? 17 : 16));
  pdf.setFontSize(5);
  pdf.text('Acesse o sistema', pageW - margin - 18, footY + (isA3 ? 20 : 19));

  pdf.setFontSize(6);
  pdf.setTextColor(100);
  const dateStr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  pdf.text(`Gerado em ${dateStr} — ${municipality.prefecture}`, margin, pageH - 4);
  pdf.text('SIRGAS 2000 / WGS84', margin + 90, pageH - 4);
  pdf.text(
    'Documento para homologação pela Secretaria Municipal de Saúde',
    margin + 45,
    pageH - 1.5,
  );

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
