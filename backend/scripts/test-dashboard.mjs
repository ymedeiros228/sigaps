import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

try {
  const user = await p.user.findFirst({
    where: { email: 'jonas@passagemfranca.ma.gov.br' },
    select: { id: true, municipalityId: true },
  });
  if (!user?.municipalityId) {
    console.log('FAIL: user without municipalityId');
    process.exit(1);
  }
  const m = user.municipalityId;
  const [ubs, streets, assigned, audit] = await Promise.all([
    p.ubs.count({ where: { municipalityId: m } }),
    p.street.count({ where: { municipalityId: m } }),
    p.street.count({ where: { municipalityId: m, microareaId: { not: null } } }),
    p.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      where: { user: { municipalityId: m } },
      include: { user: { select: { name: true, role: true } } },
    }),
  ]);
  console.log(JSON.stringify({ ok: true, municipalityId: m, ubs, streets, assigned, audit: audit.length }, null, 2));
} catch (e) {
  console.error('ERR', e.message);
  process.exit(1);
} finally {
  await p.$disconnect();
}
