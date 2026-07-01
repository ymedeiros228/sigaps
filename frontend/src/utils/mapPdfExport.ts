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
  ubsName?: string;
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
  pdf.setDrawColor(60);
  pdf.setLineWidth(0.3);
  pdf.circle(cx, cy, size / 2 - 1);
  pdf.line(cx, y + 2, cx, y + size - 2);
  pdf.line(x + 2, cy, x + size - 2, cy);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.text('N', cx - 1.5, y + 5);
}

function drawScaleBar(pdf: jsPDF, x: number, y: number, widthMm: number) {
  pdf.setDrawColor(0, 0, 0);
  pdf.setFillColor(0, 0, 0);
  pdf.setLineWidth(0.4);
  pdf.rect(x, y, widthMm, 2, 'F');
  pdf.rect(x + widthMm, y, widthMm, 2, 'S');
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.text('0', x - 1, y + 5);
  pdf.text('500 m', x + widthMm - 4, y + 5);
  pdf.text(`${widthMm * 2} m`, x + widthMm * 2 - 4, y + 5);
  pdf.setFontSize(6);
  pdf.text('Escala gráfica aproximada', x, y + 8);
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
    ubsName,
  } = input;

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const headerH = 22;
  const footerH = 16;

  const contentTop = margin + headerH;
  const contentBottom = pageH - margin - footerH;
  const contentH = contentBottom - contentTop;
  const mapW = pageW * 0.58 - margin;
  const sideW = pageW - mapW - margin * 3;
  const sideX = margin + mapW + margin;

  pdf.setFillColor(15, 61, 46);
  pdf.rect(0, 0, pageW, headerH + margin, 'F');

  if (municipality.logoUrl) {
    const logo = await loadImageDataUrl(municipality.logoUrl);
    if (logo) {
      try {
        pdf.addImage(logo, 'PNG', margin, 4, 16, 16);
      } catch {
        /* ignore */
      }
    }
  }

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  const title = neighborhoodName
    ? `MAPA DE MICROÁREAS — ${neighborhoodName.toUpperCase()}`
    : 'MAPA DE MICROÁREAS';
  pdf.text(title, margin + 20, 12);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`${municipality.name} — ${municipality.state}`, margin + 20, 18);
  if (ubsName) {
    pdf.text(`UBS: ${ubsName}`, pageW - margin - 60, 12);
  }
  pdf.text(municipality.secretariat, pageW - margin - 60, 18);

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

  let sideY = contentTop + 46;
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
    const maStreets = streets
      .filter((s) => s.microareaId === ma.id)
      .map((s) => formatStreetLabel(s))
      .slice(0, 6);

    pdf.text('Ruas:', sideX + 2, sideY + 13);
    maStreets.forEach((name, i) => {
      pdf.text(`• ${name}`, sideX + 3, sideY + 16 + i * 3);
    });
    const total = streets.filter((s) => s.microareaId === ma.id).length;
    if (total > 6) {
      pdf.text(`... +${total - 6} rua(s)`, sideX + 3, sideY + 16 + 6 * 3);
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

  drawScaleBar(pdf, margin + mapW * 0.3, footY + 2, 15);
  drawCompassRose(pdf, margin + mapW * 0.55, footY, 12);

  const qrUrl = `https://sigaps-api.onrender.com/mapa`;
  const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: 80 });
  pdf.addImage(qrDataUrl, 'PNG', pageW - margin - 16, footY, 14, 14);
  pdf.setFontSize(5.5);
  pdf.setTextColor(40, 40, 40);
  pdf.text('SIGAPS', pageW - margin - 16, footY + 16);

  pdf.setFontSize(6);
  pdf.setTextColor(100);
  const dateStr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  pdf.text(`Gerado em ${dateStr} — ${municipality.prefecture}`, margin, pageH - 4);
  pdf.text('SIRGAS 2000', margin + 90, pageH - 4);

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
