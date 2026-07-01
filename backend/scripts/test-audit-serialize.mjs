import { PrismaClient } from '@prisma/client';

const municipalityId = '4ffe6a73-6e59-4f9d-b594-a384a416e9f0';
const p = new PrismaClient();

const recentChanges = await p.auditLog.findMany({
  take: 10,
  orderBy: { createdAt: 'desc' },
  where: { user: { municipalityId } },
  include: { user: { select: { id: true, name: true, role: true } } },
});

try {
  JSON.stringify(recentChanges);
  console.log('serialize OK', recentChanges.length);
} catch (e) {
  console.error('serialize FAIL', e.message);
  console.log(JSON.stringify(recentChanges, (_, v) => (typeof v === 'bigint' ? v.toString() : v)).slice(0, 500));
}

await p.$disconnect();
