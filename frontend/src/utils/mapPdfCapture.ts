import { useMapStore } from '../store';

export type MapCaptureResult = {
  dataUrl: string;
  width: number;
  height: number;
};

/** Aguarda tiles e animações do Leaflet antes da captura. */
export function waitForMapReady(ms = 2200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Aguarda animação flyTo do mapa antes da captura. */
export function waitForMapFlyComplete(maxMs = 4500): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      unsub();
      resolve();
    };

    const startSeq = useMapStore.getState().mapFlyTarget?.seq ?? 0;
    const unsub = useMapStore.subscribe((state) => {
      const target = state.mapFlyTarget;
      if (target && target.seq > startSeq) {
        setTimeout(finish, 1200);
      }
    });
    setTimeout(finish, maxMs);
  });
}

/**
 * Metros por pixel de tela, lidos do controle de escala do Leaflet ("200 m" em N px).
 * Serve para a escala gráfica do PDF sair certa; null se o controle não estiver no mapa.
 */
export function readLeafletMetersPerPixel(leafletEl: HTMLElement): number | null {
  const line = leafletEl.querySelector('.leaflet-control-scale-line') as HTMLElement | null;
  if (!line) return null;
  const widthPx = parseFloat(line.style.width);
  const match = line.textContent?.trim().match(/^([\d.,]+)\s*(km|m)$/);
  if (!widthPx || !match) return null;
  const meters = parseFloat(match[1].replace(',', '.')) * (match[2] === 'km' ? 1000 : 1);
  return meters > 0 ? meters / widthPx : null;
}

export async function captureLeafletMapImage(
  leafletEl: HTMLElement,
  options?: { scale?: number },
): Promise<MapCaptureResult> {
  const html2canvas = (await import('html2canvas')).default;
  const scale = options?.scale ?? 3;

  const canvas = await html2canvas(leafletEl, {
    useCORS: true,
    allowTaint: true,
    logging: false,
    scale,
    backgroundColor: null,
    imageTimeout: 20_000,
    removeContainer: false,
    onclone: (doc) => {
      doc.querySelectorAll('.map-float-panel, .leaflet-control').forEach((el) => {
        (el as HTMLElement).style.display = 'none';
      });
      const container = doc.querySelector('.leaflet-container') as HTMLElement | null;
      if (container) {
        // Fundo claro: o PDF usa o mapa de ruas (não o satélite)
        container.style.background = '#f2efe9';
      }
    },
  });

  return {
    dataUrl: canvas.toDataURL('image/png', 0.95),
    width: canvas.width,
    height: canvas.height,
  };
}
