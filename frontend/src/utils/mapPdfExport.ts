import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { Microarea, Street } from '../services/api';

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

export async function generateOfficialMapPdf(input: OfficialMapPdfInput): Promise<Blob> {
  const { format, mapImageDataUrl, municipality, microareas, streets, neighborhoodName, ubsName } = input;

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const headerH = 22;
  const footerH = 18;

  const contentTop = margin + headerH;
  const contentBottom = pageH - margin - footerH;
  const contentH = contentBottom - contentTop;
  const mapW = pageW * 0.62 - margin;
  const sideW = pageW - mapW - margin * 3;

  // Header background
  pdf.setFillColor(15, 61, 46);
  pdf.rect(0, 0, pageW, headerH + margin, 'F');

  // Logo
  if (municipality.logoUrl) {
    const logo = await loadImageDataUrl(municipality.logoUrl);
    if (logo) {
      try {
        pdf.addImage(logo, 'PNG', margin, 4, 16, 16);
      } catch {
        /* formato não suportado */
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

  // Map image
  pdf.setDrawColor(200);
  pdf.setLineWidth(0.5);
  pdf.rect(margin, contentTop, mapW, contentH);
  pdf.addImage(mapImageDataUrl, 'PNG', margin + 0.5, contentTop + 0.5, mapW - 1, contentH - 1);

  // Sidebar — microarea cards
  let sideX = margin + mapW + margin;
  let sideY = contentTop;
  const cardH = 28;
  const gap = 3;

  const activeMicroareas = microareas.filter((m) =>
    streets.some((s) => s.microareaId === m.id),
  );

  pdf.setTextColor(30, 30, 30);

  for (const ma of activeMicroareas) {
    if (sideY + cardH > contentBottom) {
      pdf.addPage();
      sideY = margin;
      sideX = margin;
    }

    const [r, g, b] = hexToRgb(ma.color);
    pdf.setFillColor(r, g, b);
    pdf.rect(sideX, sideY, sideW, 5, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text(ma.name.toUpperCase(), sideX + 2, sideY + 3.5);

    pdf.setDrawColor(220);
    pdf.setFillColor(250, 250, 250);
    pdf.rect(sideX, sideY + 5, sideW, cardH - 5, 'FD');

    pdf.setTextColor(50, 50, 50);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    const acsName = ma.acs?.name ?? '—';
    pdf.text(`ACS: ${acsName}`, sideX + 2, sideY + 10);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.5);
    const maStreets = streets
      .filter((s) => s.microareaId === ma.id)
      .map((s) => `${s.streetType ?? 'Rua'} ${s.name}`)
      .slice(0, 8);

    pdf.text('Ruas e avenidas:', sideX + 2, sideY + 14);
    maStreets.forEach((name, i) => {
      pdf.text(`• ${name}`, sideX + 3, sideY + 17 + i * 3.2);
    });
    const total = streets.filter((s) => s.microareaId === ma.id).length;
    if (total > 8) {
      pdf.text(`... e mais ${total - 8} rua(s)`, sideX + 3, sideY + 17 + 8 * 3.2);
    }

    sideY += cardH + gap;
  }

  if (activeMicroareas.length === 0) {
    pdf.setTextColor(120);
    pdf.setFontSize(9);
    pdf.text('Nenhuma microárea pintada ainda.', sideX, sideY + 10);
    pdf.text('Pinte ruas no mapa antes de gerar o PDF.', sideX, sideY + 16);
  }

  // Footer
  const footY = pageH - margin - footerH + 2;
  pdf.setDrawColor(200);
  pdf.line(margin, footY - 2, pageW - margin, footY - 2);

  pdf.setTextColor(40, 40, 40);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('LEGENDA', margin, footY + 3);

  let legX = margin;
  for (const ma of activeMicroareas.slice(0, 8)) {
    const [r, g, b] = hexToRgb(ma.color);
    pdf.setFillColor(r, g, b);
    pdf.rect(legX, footY + 5, 4, 4, 'F');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.5);
    pdf.text(ma.name, legX + 5, footY + 8);
    legX += 28;
  }

  drawScaleBar(pdf, margin + mapW * 0.35, footY + 2, 15);
  drawCompassRose(pdf, margin + mapW * 0.55, footY, 12);

  // QR Code
  const qrUrl = `https://sigaps.local/mapa/${municipality.name}`;
  const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: 80 });
  pdf.addImage(qrDataUrl, 'PNG', pageW - margin - 16, footY, 14, 14);
  pdf.setFontSize(5.5);
  pdf.text('SIGAPS', pageW - margin - 16, footY + 16);
  pdf.text('Sistema de Gestão APS', pageW - margin - 16, footY + 19);

  pdf.setFontSize(6);
  pdf.setTextColor(100);
  const dateStr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  pdf.text(`Gerado em ${dateStr} — ${municipality.prefecture}`, margin, pageH - 4);
  pdf.text('Sistema de Coordenadas Geográficas — DATUM SIRGAS 2000', margin + 90, pageH - 4);

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
