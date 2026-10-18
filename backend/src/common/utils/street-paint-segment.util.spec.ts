import {
  applyUnpaintOnSide,
  applyPaintRange,
  applyUnpaintRange,
  densifyLineString,
  haversineMeters,
  mergeAdjacentSegments,
  StreetPaintSide,
  type SegmentRange,
} from './street-paint-segment.util';

describe('applyPaintRange', () => {
  it('pinta só o intervalo arrastado', () => {
    const ranges = applyPaintRange([], 2, 6, 'ma-1', StreetPaintSide.FULL, 10);
    expect(ranges).toEqual([
      {
        startIndex: 2,
        endIndex: 6,
        microareaId: 'ma-1',
        side: StreetPaintSide.FULL,
      },
    ]);
  });

  it('substitui microárea no intervalo sem afetar fora dele', () => {
    const base: SegmentRange[] = [
      {
        startIndex: 0,
        endIndex: 10,
        microareaId: 'ma-old',
        side: StreetPaintSide.FULL,
      },
    ];
    const ranges = applyPaintRange(
      base,
      3,
      7,
      'ma-new',
      StreetPaintSide.FULL,
      10,
    );
    expect(mergeAdjacentSegments(ranges)).toEqual([
      {
        startIndex: 0,
        endIndex: 3,
        microareaId: 'ma-old',
        side: StreetPaintSide.FULL,
      },
      {
        startIndex: 3,
        endIndex: 7,
        microareaId: 'ma-new',
        side: StreetPaintSide.FULL,
      },
      {
        startIndex: 7,
        endIndex: 10,
        microareaId: 'ma-old',
        side: StreetPaintSide.FULL,
      },
    ]);
  });
});

describe('applyUnpaintRange', () => {
  it('remove pintura só no intervalo arrastado', () => {
    const base: SegmentRange[] = [
      {
        startIndex: 0,
        endIndex: 10,
        microareaId: 'ma-1',
        side: StreetPaintSide.FULL,
      },
    ];
    const { ranges, removed } = applyUnpaintRange(
      base,
      2,
      5,
      StreetPaintSide.FULL,
    );
    expect(removed).toHaveLength(1);
    expect(mergeAdjacentSegments(ranges)).toEqual([
      {
        startIndex: 0,
        endIndex: 2,
        microareaId: 'ma-1',
        side: StreetPaintSide.FULL,
      },
      {
        startIndex: 5,
        endIndex: 10,
        microareaId: 'ma-1',
        side: StreetPaintSide.FULL,
      },
    ]);
  });
});

describe('applyUnpaintOnSide', () => {
  const base: SegmentRange[] = [
    {
      startIndex: 0,
      endIndex: 10,
      microareaId: 'ma-1',
      side: StreetPaintSide.FULL,
    },
  ];

  it('remove o trecho inteiro que contém o clique (não redivide com a mesma cor)', () => {
    const { ranges, removed } = applyUnpaintOnSide(
      base,
      5,
      StreetPaintSide.FULL,
    );
    expect(removed).toEqual(base[0]);
    expect(ranges).toEqual([]);
  });

  it('remove só o lado clicado em rua dual', () => {
    const dual: SegmentRange[] = [
      {
        startIndex: 0,
        endIndex: 10,
        microareaId: 'ma-1',
        side: StreetPaintSide.LEFT,
      },
      {
        startIndex: 0,
        endIndex: 10,
        microareaId: 'ma-1',
        side: StreetPaintSide.RIGHT,
      },
    ];
    const { ranges, removed } = applyUnpaintOnSide(
      dual,
      3,
      StreetPaintSide.LEFT,
    );
    expect(removed?.side).toBe(StreetPaintSide.LEFT);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].side).toBe(StreetPaintSide.RIGHT);
  });

  it('retorna null quando não há pintura no ponto', () => {
    const { ranges, removed } = applyUnpaintOnSide([], 2, StreetPaintSide.FULL);
    expect(removed).toBeNull();
    expect(ranges).toEqual([]);
  });

  it('mergeAdjacentSegments mantém trechos válidos após remoção parcial', () => {
    const partial: SegmentRange[] = [
      {
        startIndex: 0,
        endIndex: 4,
        microareaId: 'ma-1',
        side: StreetPaintSide.FULL,
      },
      {
        startIndex: 6,
        endIndex: 10,
        microareaId: 'ma-1',
        side: StreetPaintSide.FULL,
      },
    ];
    const { ranges } = applyUnpaintOnSide(partial, 2, StreetPaintSide.FULL);
    expect(mergeAdjacentSegments(ranges)).toEqual([
      {
        startIndex: 6,
        endIndex: 10,
        microareaId: 'ma-1',
        side: StreetPaintSide.FULL,
      },
    ]);
  });
});

describe('densifyLineString (pedaços de ~18 m)', () => {
  // Ruas de mentira em Passagem Franca, com trechos de 5 a 130 m (gerador fixo).
  const randomLines = (count: number): [number, number][][] => {
    let seed = 42;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    return Array.from({ length: count }, () => {
      const line: [number, number][] = [
        [-43.78 + next() * 0.01, -6.18 + next() * 0.01],
      ];
      for (let i = 0; i < 6; i++) {
        const [lng, lat] = line[line.length - 1];
        const meters = 5 + next() * 125;
        const angle = next() * 2 * Math.PI;
        line.push([
          lng + (Math.cos(angle) * meters) / 110700,
          lat + (Math.sin(angle) * meters) / 110540,
        ]);
      }
      return line;
    });
  };
  const round5 = (line: [number, number][]) =>
    line.map(
      ([lng, lat]) =>
        [Math.round(lng * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5] as [
          number,
          number,
        ],
    );

  it('recortar de novo não corta mais nada, nem com as coordenadas arredondadas que o site recebe', () => {
    for (const line of randomLines(300)) {
      const dense = densifyLineString(line).coords;
      expect(densifyLineString(dense).coords).toHaveLength(dense.length);
      expect(densifyLineString(round5(dense)).coords).toHaveLength(
        dense.length,
      );
    }
  });

  it('a rua completa (servidor) e a arredondada (site) dão o mesmo número de pedaços', () => {
    for (const line of randomLines(300)) {
      expect(densifyLineString(round5(line)).coords).toHaveLength(
        densifyLineString(line).coords.length,
      );
    }
  });

  it('nenhum pedaço passa de ~20 m', () => {
    for (const line of randomLines(50)) {
      const dense = densifyLineString(line).coords;
      for (let i = 0; i < dense.length - 1; i++) {
        expect(haversineMeters(dense[i], dense[i + 1])).toBeLessThanOrEqual(
          20.5,
        );
      }
    }
  });
});
