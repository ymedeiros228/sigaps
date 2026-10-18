import { describe, expect, it } from 'vitest';
import type { Street } from '../services/api';
import {
  buildStreetMapFeatures,
  closestDrawnSideEdge,
  effectivePaintSide,
  nearestDrawnStreetId,
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

  it('perto de uma esquina o lado segue o trecho onde está o dedo', () => {
    // Vai para leste e vira para o norte no 2º ponto.
    const corner = {
      ...eastward,
      geojson: {
        type: 'LineString',
        coordinates: [
          [-43.78, -6.18],
          [-43.779, -6.18],
          [-43.779, -6.179],
        ],
      },
    } as unknown as Street;
    // Ao norte do trecho que vai para leste, a ~22 m da esquina = esquerdo.
    expect(effectivePaintSide(corner, -6.17996, -43.7792, 'LEFT', 'micro', false)).toBe('LEFT');
    // A oeste do trecho que sobe para o norte = esquerdo; a leste = direito.
    expect(effectivePaintSide(corner, -6.1798, -43.77904, 'LEFT', 'micro', false)).toBe('LEFT');
    expect(effectivePaintSide(corner, -6.1798, -43.77896, 'LEFT', 'micro', false)).toBe('RIGHT');
  });

  it('rua de terra (um lado só) ignora o lado', () => {
    const dirt = { ...eastward, streetType: 'Estrada de terra' } as Street;
    expect(effectivePaintSide(dirt, -6.17995, -43.779, 'LEFT', 'micro', false)).toBe('FULL');
  });
});

describe('toque no modo trecho: tracinho desenhado mais perto do dedo', () => {
  it('rua reta: escolhe o pedaço e o lado onde está o dedo', () => {
    // 2 pedaços de ~110 m (a rua é densificada em pedaços de ~18 m antes, no mapa).
    const hitNorth = closestDrawnSideEdge(eastward, -6.17996, -43.7795, 4);
    expect(hitNorth).toEqual({ lo: 0, hi: 1, side: 'LEFT' });
    const hitSouth = closestDrawnSideEdge(eastward, -6.18004, -43.7785, 4);
    expect(hitSouth).toEqual({ lo: 1, hi: 2, side: 'RIGHT' });
  });

  it('emenda curta numa esquina: vale o tracinho que está desenhado ali', () => {
    // Sobe 3 m para o norte e vira para o oeste (curva à esquerda).
    const kink = {
      ...eastward,
      geojson: {
        type: 'LineString',
        coordinates: [
          [-43.78, -6.18],
          [-43.78, -6.179973],
          [-43.7805, -6.179973],
        ],
      },
    } as unknown as Street;
    // Lado direito (leste) do pedacinho que sobe, já perto da curva.
    const side = closestDrawnSideEdge(kink, -6.179975, -43.779962, 4);
    expect(side).toEqual({ lo: 0, hi: 1, side: 'RIGHT' });
  });

  it('duas ruas perto: vale a rua do tracinho mais perto do dedo', () => {
    const line = (lat: number): GeoJSON.LineString => ({
      type: 'LineString',
      coordinates: [
        [-43.78, lat],
        [-43.779, lat],
      ],
    });
    const features = [
      { properties: { streetId: 'rua-a' }, geometry: line(-6.18) },
      { properties: { streetId: 'rua-b' }, geometry: line(-6.17993) }, // ~8 m ao norte
    ];
    expect(nearestDrawnStreetId(features, -6.17999, -43.7795)).toBe('rua-a');
    expect(nearestDrawnStreetId(features, -6.17994, -43.7795)).toBe('rua-b');
    expect(nearestDrawnStreetId([], -6.18, -43.7795)).toBeNull();
  });

  it('rua de terra (um lado só) devolve o lado FULL', () => {
    const dirt = { ...eastward, streetType: 'Estrada de terra' } as Street;
    expect(closestDrawnSideEdge(dirt, -6.17996, -43.7795, 4).side).toBe('FULL');
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
