import L from 'leaflet';
import { canvasScaleFor } from './canvasScale';

type CanvasInternals = {
  _map: L.Map & { _animatingZoom?: boolean };
  _bounds: L.Bounds & { min: L.Point; max: L.Point };
  _container: HTMLCanvasElement;
  _ctx: CanvasRenderingContext2D;
  fire: (type: string) => void;
};

let patched = false;

/**
 * O Canvas do Leaflet 1.9 desenha no máximo em 2x. Em celular com tela 3x (a maioria hoje)
 * o navegador amplia a imagem e as ruas ficam borradas. Este ajuste usa a densidade real da tela.
 */
export function patchLeafletCanvasForHighDpi() {
  if (patched) return;
  patched = true;
  const rendererUpdate = (L.Renderer.prototype as unknown as { _update: () => void })._update;
  (L.Canvas.prototype as unknown as { _update: () => void })._update = function (
    this: CanvasInternals,
  ) {
    if (this._map._animatingZoom && this._bounds) return;
    rendererUpdate.call(this);
    const bounds = this._bounds;
    const size = bounds.getSize();
    const scale = canvasScaleFor(
      window.devicePixelRatio || 1,
      (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    );
    const container = this._container;
    L.DomUtil.setPosition(container, bounds.min);
    container.width = scale * size.x;
    container.height = scale * size.y;
    container.style.width = `${size.x}px`;
    container.style.height = `${size.y}px`;
    if (scale !== 1) this._ctx.scale(scale, scale);
    this._ctx.translate(-bounds.min.x, -bounds.min.y);
    this.fire('update');
  };
}
