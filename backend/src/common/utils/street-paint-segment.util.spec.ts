import {
  applyUnpaintOnSide,
  applyPaintRange,
  applyUnpaintRange,
  mergeAdjacentSegments,
  StreetPaintSide,
  type SegmentRange,
} from './street-paint-segment.util';

describe('applyPaintRange', () => {
  it('pinta só o intervalo arrastado', () => {
    const ranges = applyPaintRange([], 2, 6, 'ma-1', StreetPaintSide.FULL, 10);
    expect(ranges).toEqual([
      { startIndex: 2, endIndex: 6, microareaId: 'ma-1', side: StreetPaintSide.FULL },
    ]);
  });

  it('substitui microárea no intervalo sem afetar fora dele', () => {
    const base: SegmentRange[] = [
      { startIndex: 0, endIndex: 10, microareaId: 'ma-old', side: StreetPaintSide.FULL },
    ];
    const ranges = applyPaintRange(base, 3, 7, 'ma-new', StreetPaintSide.FULL, 10);
    expect(mergeAdjacentSegments(ranges)).toEqual([
      { startIndex: 0, endIndex: 3, microareaId: 'ma-old', side: StreetPaintSide.FULL },
      { startIndex: 3, endIndex: 7, microareaId: 'ma-new', side: StreetPaintSide.FULL },
      { startIndex: 7, endIndex: 10, microareaId: 'ma-old', side: StreetPaintSide.FULL },
    ]);
  });
});

describe('applyUnpaintRange', () => {
  it('remove pintura só no intervalo arrastado', () => {
    const base: SegmentRange[] = [
      { startIndex: 0, endIndex: 10, microareaId: 'ma-1', side: StreetPaintSide.FULL },
    ];
    const { ranges, removed } = applyUnpaintRange(base, 2, 5, StreetPaintSide.FULL);
    expect(removed).toHaveLength(1);
    expect(mergeAdjacentSegments(ranges)).toEqual([
      { startIndex: 0, endIndex: 2, microareaId: 'ma-1', side: StreetPaintSide.FULL },
      { startIndex: 5, endIndex: 10, microareaId: 'ma-1', side: StreetPaintSide.FULL },
    ]);
  });
});

describe('applyUnpaintOnSide', () => {
  const base: SegmentRange[] = [
    { startIndex: 0, endIndex: 10, microareaId: 'ma-1', side: StreetPaintSide.FULL },
  ];

  it('remove o trecho inteiro que contém o clique (não redivide com a mesma cor)', () => {
    const { ranges, removed } = applyUnpaintOnSide(base, 5, StreetPaintSide.FULL);
    expect(removed).toEqual(base[0]);
    expect(ranges).toEqual([]);
  });

  it('remove só o lado clicado em rua dual', () => {
    const dual: SegmentRange[] = [
      { startIndex: 0, endIndex: 10, microareaId: 'ma-1', side: StreetPaintSide.LEFT },
      { startIndex: 0, endIndex: 10, microareaId: 'ma-1', side: StreetPaintSide.RIGHT },
    ];
    const { ranges, removed } = applyUnpaintOnSide(dual, 3, StreetPaintSide.LEFT);
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
      { startIndex: 0, endIndex: 4, microareaId: 'ma-1', side: StreetPaintSide.FULL },
      { startIndex: 6, endIndex: 10, microareaId: 'ma-1', side: StreetPaintSide.FULL },
    ];
    const { ranges } = applyUnpaintOnSide(partial, 2, StreetPaintSide.FULL);
    expect(mergeAdjacentSegments(ranges)).toEqual([
      { startIndex: 6, endIndex: 10, microareaId: 'ma-1', side: StreetPaintSide.FULL },
    ]);
  });
});
