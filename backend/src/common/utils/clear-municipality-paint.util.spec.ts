import { clearMunicipalityPaint } from './clear-municipality-paint.util';

describe('clearMunicipalityPaint', () => {
  const municipalityId = 'muni-1';

  const prisma = {
    street: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    streetPaintSegment: {
      deleteMany: jest.fn(),
    },
    microareaPaintZone: {
      deleteMany: jest.fn(),
    },
    microarea: {
      findMany: jest.fn(),
    },
    $executeRaw: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.street.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
    prisma.streetPaintSegment.deleteMany.mockResolvedValue({ count: 3 });
    prisma.street.updateMany.mockResolvedValue({ count: 2 });
    prisma.microareaPaintZone.deleteMany.mockResolvedValue({ count: 1 });
    prisma.microarea.findMany.mockResolvedValue([{ id: 'ma1' }]);
    prisma.$executeRaw.mockResolvedValue(undefined);
  });

  it('remove segmentos, vínculos e zonas mantendo cadastros', async () => {
    const result = await clearMunicipalityPaint(
      prisma as never,
      municipalityId,
    );

    expect(prisma.streetPaintSegment.deleteMany).toHaveBeenCalledWith({
      where: { street: { municipalityId } },
    });
    expect(prisma.street.updateMany).toHaveBeenCalledWith({
      where: { municipalityId, microareaId: { not: null } },
      data: { microareaId: null },
    });
    expect(prisma.microareaPaintZone.deleteMany).toHaveBeenCalledWith({
      where: { municipalityId },
    });
    expect(result).toEqual({ clearedStreets: 2, clearedPaintZones: 1 });
  });

  it('retorna zeros quando não há pintura', async () => {
    prisma.street.findMany.mockResolvedValue([]);
    prisma.microareaPaintZone.deleteMany.mockResolvedValue({ count: 0 });

    const result = await clearMunicipalityPaint(
      prisma as never,
      municipalityId,
    );

    expect(result).toEqual({ clearedStreets: 0, clearedPaintZones: 0 });
  });
});
