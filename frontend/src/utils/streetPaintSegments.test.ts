import { describe, expect, it } from 'vitest';
import type { Street } from '../services/api';
import {
  buildStreetMapFeatures,
  effectivePaintSide,
  offsetLineForSide,
  sideOffsetMetersForZoom,
  streetZoomBucket,
} from './streetPaintSegments';

/** Rua de mão dupla (tem osmId) indo de oeste para leste, na altura de Passagem Franca. */
const eastward = {
  id: 'r1',
  name: 'Rua Teste',
  streetType: 'Rua',
  osmId: '123',
  microareaId: null,
  microarea: null,
  paintSegments: [],
  familyCount: 0,
  geojson: {
    type: 'LineString',
    coordinates: [
      [-43.78, -6.18],
      [-43.779, -6.18],
      [-43.778, -6.18],
    ],
  },
} as unknown as Street;

const ctx = {
  highlightedId: null,
  selectedIds: new Set<string>(),
  dragPaintIds: new Set<string>(),
  activeColor: '#34C759',
  paintMode: true,
  splitUnpaintedEdges: true,
};

describe('lado da pintura pelo toque', () => {
  it('toque ao norte de uma rua que vai para leste = lado esquerdo; ao sul = direito', () => {
    expect(effectivePaintSide(eastward, -6.17995, -43.779, 'LEFT', 'micro', false)).toBe('LEFT');
    expect(effectivePaintSide(eastward, -6.18005, -43.779, 'LEFT', 'micro', false)).toBe('RIGHT');
  });

  it('o botão do painel não manda mais no lado: "Lado inteiro" também segue o toque', () => {
    expect(effectivePaintSide(eastward, -6.18005, -43.779, 'LEFT', 'whole', false)).toBe('RIGHT');
  });

  it('"Rua inteira" pinta os dois lados', () => {
    expect(effectivePaintSide(eastward, -6.17995, -43.779, 'FULL', 'whole', false)).toBe('BOTH');
  });

  it('rua de terra (um lado só) ignora o lado', () => {
    const dirt = { ...eastward, streetType: 'Estrada de terra' } as Street;
    expect(effectivePaintSide(dirt, -6.17995, -43.779, 'LEFT', 'micro', false)).toBe('FULL');
  });
});

describe('desenho no modo trecho', () => {
  it('rua de dois lados sem pintura mostra tracinhos dos DOIS lados', () => {
    const { unpainted } = buildStreetMapFeatures(eastward, ctx);
    const sides = new Set(unpainted.map((f) => f.properties.side));
    expect(sides).toEqual(new Set(['LEFT', 'RIGHT']));
  });
});

describe('deslocamento dos lados', () => {
  it('fica entre 4 e 12 m e diminui ao aproximar', () => {
    const z16 = sideOffsetMetersForZoom(streetZoomBucket(16));
    const z18 = sideOffsetMetersForZoom(streetZoomBucket(18));
    expect(z16).toBeLessThanOrEqual(12);
    expect(z18).toBeGreaterThanOrEqual(4);
    expect(z16).toBeGreaterThan(z18);
  });

  it('rua que cruza o norte (rumos 350° e 10°) desloca o lado esquerdo para oeste', () => {
    const line: GeoJSON.LineString = {
      type: 'LineString',
      coordinates: [
        [-43.7801, -6.181],
        [-43.78, -6.18],
        [-43.7801, -6.179],
      ],
    };
    const left = offsetLineForSide(line, 'LEFT', 5);
    // Vértice do meio: indo para o norte, a esquerda é o oeste (longitude menor).
    expect(left.coordinates[1][0]).toBeLessThan(-43.78);
  });
});
