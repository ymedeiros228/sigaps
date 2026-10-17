import { describe, expect, it } from 'vitest';
import { canvasScaleFor } from './canvasScale';

describe('escala do canvas das ruas', () => {
  it('tela comum fica em 1x e tela 2x em 2x, como o Leaflet já fazia', () => {
    expect(canvasScaleFor(1)).toBe(1);
    expect(canvasScaleFor(1.25)).toBe(2);
    expect(canvasScaleFor(2)).toBe(2);
  });

  it('celular com tela 3x (ou 2,6x) desenha em 3x para as ruas ficarem nítidas', () => {
    expect(canvasScaleFor(3)).toBe(3);
    expect(canvasScaleFor(2.625)).toBe(3);
  });

  it('celular com pouca memória continua em 2x', () => {
    expect(canvasScaleFor(3, 2)).toBe(2);
    expect(canvasScaleFor(3, 4)).toBe(3);
  });
});
