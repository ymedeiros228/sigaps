import type L from 'leaflet';
import { layoutPdfLabels } from './pdfLabelLayout';
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

/** Espera os blocos (tiles) do mapa base terminarem de carregar, com limite de tempo. */
async function waitForTiles(el: HTMLElement, maxMs = 9000): Promise<void> {
  const start = Date.now();
  await new Promise((r) => setTimeout(r, 250));
  while (Date.now() - start < maxMs) {
    const pending = el.querySelectorAll('img.leaflet-tile:not(.leaflet-tile-loaded)').length;
    if (pending === 0) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  await new Promise((r) => setTimeout(r, 450));
}

export interface PdfCaptureOptions {
  /** Largura/altura da caixa do mapa na folha. */
  boxRatio: number;
  /** Largura em pixels de tela do mapa fotografado (define o tamanho relativo dos nomes). */
  cssWidth: number;
  /** O que precisa caber no mapa. null = usar o que está na tela agora. */
  bounds: L.LatLngBoundsExpression | null;
  /** Margem em pixels de cada lado. */
  marginPx: number;
  /** Chamado com a área final do mapa, antes da foto (ex.: buscar pontos de referência e desenhá-los). */
  beforeCapture?: (visible: L.LatLngBounds) => Promise<void>;
  scale?: number;
}

export interface PdfCaptureResult extends MapCaptureResult {
  /** Metros por pixel da imagem gerada (para a escala gráfica). */
  metersPerPixel: number;
}

/**
 * Foto do mapa no formato exato da caixa da folha: redimensiona o mapa, enquadra com zoom
 * fracionado (sem arredondar para baixo), espera carregar, fotografa e devolve tudo como estava.
 */
export async function captureMapForPdf(map: L.Map, options: PdfCaptureOptions): Promise<PdfCaptureResult> {
  const el = map.getContainer();
  const prevCss = el.style.cssText;
  const prevSnap = map.options.zoomSnap;
  const prevCenter = map.getCenter();
  const prevZoom = map.getZoom();
  const targetBounds = options.bounds ?? map.getBounds();
  const scale = options.scale ?? 2;

  const width = Math.round(options.cssWidth);
  const height = Math.round(width / options.boxRatio);

  try {
    el.style.position = 'fixed';
    el.style.left = '0px';
    el.style.top = '0px';
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.style.minHeight = '0px';
    el.style.zIndex = '0';
    map.invalidateSize({ animate: false, pan: false });
    map.options.zoomSnap = 0;
    map.fitBounds(targetBounds, {
      padding: [options.marginPx, options.marginPx],
      maxZoom: 18,
      animate: false,
    });

    if (options.beforeCapture) await options.beforeCapture(map.getBounds());
    await waitForTiles(el);
    // Nomes que se cobrem mudam de lado antes da foto.
    layoutPdfLabels(el);

    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(el, {
      useCORS: true,
      allowTaint: true,
      logging: false,
      scale,
      backgroundColor: '#f2efe9',
      imageTimeout: 20_000,
      x: 0,
      y: 0,
      width,
      height,
      scrollX: 0,
      scrollY: 0,
      windowWidth: Math.max(width, window.innerWidth),
      windowHeight: Math.max(height, window.innerHeight),
      onclone: (doc) => {
        doc.querySelectorAll('.leaflet-control').forEach((c) => {
          (c as HTMLElement).style.display = 'none';
        });
      },
    });

    const lat = map.getCenter().lat;
    const metersPerCssPx = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (256 * 2 ** map.getZoom());

    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: canvas.width,
      height: canvas.height,
      metersPerPixel: (metersPerCssPx * width) / canvas.width,
    };
  } finally {
    el.style.cssText = prevCss;
    map.options.zoomSnap = prevSnap;
    map.invalidateSize({ animate: false, pan: false });
    map.setView(prevCenter, prevZoom, { animate: false });
  }
}
