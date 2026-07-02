import type { OperationalChecklist } from '../services/api';
import type { MunicipalityPdfInfo } from './mapPdfExport';

export interface HomologationCertificateInput {
  municipality: MunicipalityPdfInfo;
  homologation: {
    at: string;
    by: string;
    notes?: string | null;
  };
  checklist: OperationalChecklist;
}

function truncate(pdf: import('jspdf').jsPDF, text: string, maxWidth: number) {
  if (pdf.getTextWidth(text) <= maxWidth) return text;
  let out = text;
  while (out.length > 3 && pdf.getTextWidth(`${out}…`) > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

export async function downloadHomologationCertificate(input: HomologationCertificateInput) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = margin;

  pdf.setDrawColor(25, 118, 210);
  pdf.setLineWidth(0.8);
  pdf.rect(margin, margin, contentW, 267);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(25, 118, 210);
  pdf.text(input.municipality.prefecture.toUpperCase(), pageW / 2, y + 8, { align: 'center' });
  pdf.setFontSize(9);
  pdf.text(input.municipality.secretariat, pageW / 2, y + 14, { align: 'center' });

  y += 24;
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(16);
  pdf.text('TERMO DE HOMOLOGAÇÃO', pageW / 2, y, { align: 'center' });
  y += 8;
  pdf.setFontSize(12);
  pdf.text('Mapa Oficial de Microáreas — APS', pageW / 2, y, { align: 'center' });

  y += 16;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  const intro = `Certificamos que o mapa territorial de microáreas do município de ${input.municipality.name}/${input.municipality.state}, gerado pelo sistema SIGAPS, foi revisado e homologado pela Secretaria Municipal de Saúde para uso oficial na organização da Atenção Primária à Saúde.`;
  const introLines = pdf.splitTextToSize(intro, contentW - 10);
  pdf.text(introLines, margin + 5, y);
  y += introLines.length * 6 + 8;

  pdf.setFont('helvetica', 'bold');
  pdf.text('Dados do registro', margin + 5, y);
  y += 7;
  pdf.setFont('helvetica', 'normal');
  const dateStr = new Date(input.homologation.at).toLocaleString('pt-BR');
  pdf.text(`Município: ${input.municipality.name}/${input.municipality.state}`, margin + 5, y);
  y += 6;
  pdf.text(`Data da homologação: ${dateStr}`, margin + 5, y);
  y += 6;
  pdf.text(`Responsável: ${input.homologation.by}`, margin + 5, y);
  y += 6;
  pdf.text(
    `Checklist operacional: ${input.checklist.completed}/${input.checklist.total} itens (${input.checklist.progressPct}%)`,
    margin + 5,
    y,
  );
  y += 8;

  if (input.homologation.notes?.trim()) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Observações', margin + 5, y);
    y += 6;
    pdf.setFont('helvetica', 'normal');
    const noteLines = pdf.splitTextToSize(input.homologation.notes.trim(), contentW - 10);
    pdf.text(noteLines, margin + 5, y);
    y += noteLines.length * 6 + 6;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.text('Itens verificados no SIGAPS', margin + 5, y);
  y += 7;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  for (const item of input.checklist.items) {
    if (y > 250) break;
    const mark = item.done ? '[x]' : '[ ]';
    pdf.text(
      truncate(pdf, `${mark} ${item.label} — ${item.detail}`, contentW - 10),
      margin + 5,
      y,
    );
    y += 5.5;
  }

  y = Math.max(y + 12, 230);
  const sigW = (contentW - 10) / 2;
  pdf.setDrawColor(120, 120, 120);
  pdf.line(margin + 5, y, margin + 5 + sigW - 8, y);
  pdf.line(margin + 5 + sigW + 8, y, margin + 5 + contentW - 10, y);
  pdf.setFontSize(9);
  pdf.text('Secretário(a) de Saúde', margin + 5, y + 5);
  pdf.text('Coordenador(a) APS', margin + 5 + sigW + 8, y + 5);

  y += 14;
  pdf.setFontSize(8);
  pdf.setTextColor(100, 100, 100);
  pdf.text(
    `Documento emitido pelo SIGAPS em ${new Date().toLocaleString('pt-BR')}. Válido com o mapa PDF homologado correspondente.`,
    pageW / 2,
    y,
    { align: 'center' },
  );

  const slug = input.municipality.name.toLowerCase().replace(/\s+/g, '-').slice(0, 24);
  pdf.save(`sigaps-termo-homologacao-${slug}.pdf`);
}
