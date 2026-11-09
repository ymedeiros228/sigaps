/**
 * Arruma os nomes do mapa antes da foto do PDF: cada nome tenta ficar embaixo do
 * ponto; se bater em outro nome ou em outro marcador, vai para cima, direita ou
 * esquerda. Ordem de prioridade: data-prio maior primeiro (povoados da área, UBS…).
 *
 * Os ícones marcam o nome com `.pdf-label` (e `data-prio`) e a bolinha com `.pdf-dot`.
 */

type Side = 'baixo' | 'cima' | 'direita' | 'esquerda';
const SIDES: Side[] = ['baixo', 'cima', 'direita', 'esquerda'];

function place(label: HTMLElement, side: Side, gap: number) {
  const s = label.style;
  s.top = s.bottom = s.left = s.right = 'auto';
  if (side === 'baixo' || side === 'cima') {
    s.left = '50%';
    s.transform = 'translateX(-50%)';
    if (side === 'baixo') s.top = `calc(100% + ${gap}px)`;
    else s.bottom = `calc(100% + ${gap}px)`;
  } else {
    s.top = '50%';
    s.transform = 'translateY(-50%)';
    if (side === 'direita') s.left = `calc(100% + ${gap + 2}px)`;
    else s.right = `calc(100% + ${gap + 2}px)`;
  }
}

const overlaps = (a: DOMRect, b: DOMRect, pad = 1) =>
  a.left < b.right + pad && a.right > b.left - pad && a.top < b.bottom + pad && a.bottom > b.top - pad;

/** Devolve quantos nomes mudaram de lugar (só para conferência). */
export function layoutPdfLabels(container: HTMLElement): number {
  const labels = [...container.querySelectorAll<HTMLElement>('.pdf-label')];
  if (labels.length === 0) return 0;
  const dots = [...container.querySelectorAll<HTMLElement>('.pdf-dot')].map((d) => d.getBoundingClientRect());
  const bounds = container.getBoundingClientRect();

  labels.sort((a, b) => Number(b.dataset.prio ?? 0) - Number(a.dataset.prio ?? 0));
  const taken: DOMRect[] = [];
  let moved = 0;

  for (const label of labels) {
    const ownDot = label.parentElement?.querySelector('.pdf-dot')?.getBoundingClientRect();
    let best: { side: Side; hits: number } | null = null;
    for (const side of SIDES) {
      place(label, side, 2);
      const r = label.getBoundingClientRect();
      const outside = r.left < bounds.left || r.right > bounds.right || r.top < bounds.top || r.bottom > bounds.bottom;
      const hits =
        taken.filter((t) => overlaps(r, t)).length * 2 +
        dots.filter((d) => d !== ownDot && !(ownDot && d.x === ownDot.x && d.y === ownDot.y) && overlaps(r, d, 0)).length +
        (outside ? 3 : 0);
      if (!best || hits < best.hits) best = { side, hits };
      if (hits === 0) break;
    }
    place(label, best!.side, 2);
    if (best!.side !== 'baixo') moved++;
    taken.push(label.getBoundingClientRect());
  }
  return moved;
}
