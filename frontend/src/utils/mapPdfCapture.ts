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
        container.style.background = '#101418';
      }
    },
  });

  return {
    dataUrl: canvas.toDataURL('image/png', 0.95),
    width: canvas.width,
    height: canvas.height,
  };
}
