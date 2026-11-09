import { describe, expect, it } from 'vitest';
import type { Street } from '../services/api';
import { detectAreaKind, paintedLinesOfStreet } from './pdfMapSettings';

// Linha reta de ~`km` quilômetros para o norte, perto de Passagem Franca.
const line = (km: number): GeoJSON.LineString => ({
  type: 'LineString',
  coordinates: [
    [-43.78, -6.19],
    [-43.78, -6.19 + km / 110.57],
  ],
});

const street = (over: Partial<Street>) => ({ geojson: line(9), paintSegments: [], ...over }) as unknown as Street;
const seg = (microareaId: string, km: number) => ({ microareaId, geojson: line(km) });

describe('paintedLinesOfStreet', () => {
  it('estrada longa com um trecho pintado conta só o trecho', () => {
    const s = street({ microareaId: undefined, paintSegments: [seg('a', 0.1)] as never });
    expect(paintedLinesOfStreet(s, new Set(['a']))).toEqual([line(0.1)]);
  });

  it('trecho de microárea fora do recorte não entra', () => {
    const s = street({ microareaId: undefined, paintSegments: [seg('b', 0.1)] as never });
    expect(paintedLinesOfStreet(s, new Set(['a']))).toEqual([]);
  });

  it('rua inteira pintada conta inteira', () => {
    const s = street({ microareaId: 'a' });
    expect(paintedLinesOfStreet(s, new Set(['a']))).toEqual([line(9)]);
  });
});

describe('detectAreaKind', () => {
  it('trecho pequeno de estrada longa continua urbano', () => {
    const s = street({ microareaId: undefined, paintSegments: [seg('a', 0.1)] as never });
    expect(detectAreaKind([s], [], new Set(['a']))).toBe('urbana');
  });

  it('rua inteira longa é rural', () => {
    expect(detectAreaKind([street({ microareaId: 'a' })], [], new Set(['a']))).toBe('rural');
  });
});
