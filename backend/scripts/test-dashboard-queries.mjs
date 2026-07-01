import { PrismaClient } from '@prisma/client';

const municipalityId = '4ffe6a73-6e59-4f9d-b594-a384a416e9f0';
const p = new PrismaClient();

const queries = {
  ubs: () => p.ubs.count({ where: { municipalityId } }),
  acs: () => p.acs.count({ where: { municipalityId, status: 'ATIVO' } }),
  microareas: () => p.microarea.count({ where: { municipalityId } }),
  streetStats: () =>
    p.street.aggregate({
      where: { municipalityId },
      _sum: { familyCount: true, inhabitantCount: true },
      _count: { _all: true },
    }),
  municipality: () => p.municipality.findUniqueOrThrow({ where: { id: municipalityId } }),
  microareasList: () =>
    p.microarea.findMany({
      where: { municipalityId },
      include: {
        acs: { select: { id: true, name: true, phone: true, photoUrl: true } },
        ubs: { select: { id: true, name: true } },
        _count: { select: { streets: true } },
      },
      orderBy: { number: 'asc' },
    }),
};

for (const [name, fn] of Object.entries(queries)) {
  try {
    await fn();
    console.log('OK', name);
  } catch (e) {
    console.error('FAIL', name, e.code, e.message);
  }
}

await p.$disconnect();
