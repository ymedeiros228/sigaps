import type { PrismaClient } from '@prisma/client';

export type ClearMunicipalityPaintResult = {
  clearedStreets: number;
  clearedPaintZones: number;
};

/**
 * Remove pintura territorial (segmentos, vínculos de rua e círculos) mantendo cadastros.
 * Usado no seed e na preparação para entrega ao usuário final.
 */
export async function clearMunicipalityPaint(
  prisma: PrismaClient,
  municipalityId: string,
): Promise<ClearMunicipalityPaintResult> {
  const painted = await prisma.street.findMany({
    where: {
      municipalityId,
      OR: [{ microareaId: { not: null } }, { paintSegments: { some: {} } }],
    },
    select: { id: true },
  });

  await prisma.streetPaintSegment.deleteMany({
    where: { street: { municipalityId } },
  });

  await prisma.street.updateMany({
    where: { municipalityId, microareaId: { not: null } },
    data: { microareaId: null },
  });

  const zones = await prisma.microareaPaintZone.deleteMany({
    where: { municipalityId },
  });

  const microareas = await prisma.microarea.findMany({
    where: { municipalityId },
    select: { id: true },
  });
  for (const { id } of microareas) {
    try {
      await prisma.$executeRaw`SELECT update_microarea_envelope(${id}::uuid)`;
    } catch {
      /* PostGIS opcional */
    }
  }

  return {
    clearedStreets: painted.length,
    clearedPaintZones: zones.count,
  };
}
