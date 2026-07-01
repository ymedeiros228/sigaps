import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const municipality = await prisma.municipality.upsert({
    where: { name_state: { name: 'Passagem Franca', state: 'MA' } },
    create: {
      name: 'Passagem Franca',
      state: 'MA',
      prefecture: 'Prefeitura Municipal de Passagem Franca',
      secretariat: 'Secretaria Municipal de Saúde',
      latitude: -6.1828,
      longitude: -43.7869,
    },
    update: {},
  });

  const passwordHash = await bcrypt.hash('Sigaps@2026', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'jonas@passagemfranca.ma.gov.br' },
    create: {
      email: 'jonas@passagemfranca.ma.gov.br',
      passwordHash,
      name: 'Jonas Almeida Medeiros',
      role: UserRole.ENFERMEIRO,
      municipalityId: municipality.id,
    },
    update: { passwordHash },
  });

  const colors = ['#4CAF50', '#FF9800', '#2196F3', '#9C27B0', '#F44336'];
  for (let i = 1; i <= 5; i++) {
    await prisma.microarea.upsert({
      where: {
        number_municipalityId: { number: i, municipalityId: municipality.id },
      },
      create: {
        number: i,
        name: `Microárea ${String(i).padStart(2, '0')}`,
        color: colors[i - 1],
        municipalityId: municipality.id,
        description: `Microárea territorial ${i} - Passagem Franca`,
      },
      update: {},
    });
  }

  console.log('Seed concluído!');
  console.log(`Município: ${municipality.name} (${municipality.id})`);
  console.log(`Usuário: ${admin.email} / Sigaps@2026`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
