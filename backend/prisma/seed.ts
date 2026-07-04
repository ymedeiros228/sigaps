import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { importStreetsFromBundledGeoJson } from '../src/common/utils/bundled-streets.import';

const prisma = new PrismaClient();

function ensureMunicipalityLogo() {
  const src = join(process.cwd(), 'assets', 'logos', 'passagem-franca.png');
  const destDir = join(process.cwd(), 'uploads', 'logos');
  const dest = join(destDir, 'passagem-franca.png');
  if (!existsSync(src)) return;
  mkdirSync(destDir, { recursive: true });
  copyFileSync(src, dest);
}

async function main() {
  ensureMunicipalityLogo();
  const municipality = await prisma.municipality.upsert({
    where: { name_state: { name: 'Passagem Franca', state: 'MA' } },
    create: {
      name: 'Passagem Franca',
      state: 'MA',
      prefecture: 'Prefeitura Municipal de Passagem Franca',
      secretariat: 'Secretaria Municipal de Saúde',
      logoUrl: '/uploads/logos/passagem-franca.png',
      latitude: -6.1828,
      longitude: -43.7869,
      osmRelationId: 332931,
    },
    update: {
      logoUrl: '/uploads/logos/passagem-franca.png',
      osmRelationId: 332931,
    },
  });

  const passwordHash = await bcrypt.hash('Sigaps@2026', 10);

  await prisma.user.upsert({
    where: { email: 'jonas@passagemfranca.ma.gov.br' },
    create: {
      email: 'jonas@passagemfranca.ma.gov.br',
      passwordHash,
      name: 'Jonas Almeida Medeiros',
      role: UserRole.ENFERMEIRO,
      municipalityId: municipality.id,
    },
    update: { passwordHash, municipalityId: municipality.id, role: UserRole.ENFERMEIRO },
  });

  await prisma.user.upsert({
    where: { email: 'admin@passagemfranca.ma.gov.br' },
    create: {
      email: 'admin@passagemfranca.ma.gov.br',
      passwordHash,
      name: 'Administrador SIGAPS',
      role: UserRole.ADMINISTRADOR,
      municipalityId: municipality.id,
    },
    update: { passwordHash, municipalityId: municipality.id, role: UserRole.ADMINISTRADOR },
  });

  const colors = ['#E6194B', '#4363D8', '#3CB44B', '#FFE119', '#911EB4'];
  const microareas = [];
  for (let i = 1; i <= 5; i++) {
    const ma = await prisma.microarea.upsert({
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
    microareas.push(ma);
  }

  const ubs = await prisma.ubs.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'UBS Centro',
      address: 'Rua Coronel Manoel Bandeira, s/n — Centro',
      phone: '(99) 3431-0000',
      coordinator: 'Coordenação APS',
      latitude: -6.1835,
      longitude: -43.7875,
      municipalityId: municipality.id,
    },
    update: {},
  });

  await prisma.neighborhood.createMany({
    data: [
      { name: 'Centro', municipalityId: municipality.id },
      { name: 'São Francisco', municipalityId: municipality.id },
      { name: 'Boa Vista', municipalityId: municipality.id },
    ],
    skipDuplicates: true,
  });

  const acs1 = await prisma.acs.upsert({
    where: { cpf: '11122233344' },
    create: {
      name: 'Ana Paula Santos',
      cpf: '11122233344',
      phone: '(99) 98888-0001',
      municipalityId: municipality.id,
      status: 'ATIVO',
    },
    update: {},
  });

  await prisma.microarea.update({
    where: { id: microareas[0].id },
    data: { ubsId: ubs.id, acsId: acs1.id },
  });

  const acsUser = await prisma.user.upsert({
    where: { email: 'acs@passagemfranca.ma.gov.br' },
    create: {
      email: 'acs@passagemfranca.ma.gov.br',
      passwordHash,
      name: 'Ana Paula Santos',
      role: UserRole.ACS,
      municipalityId: municipality.id,
    },
    update: {
      passwordHash,
      municipalityId: municipality.id,
      role: UserRole.ACS,
      name: 'Ana Paula Santos',
    },
  });

  await prisma.acs.update({
    where: { id: acs1.id },
    data: { userId: acsUser.id },
  });

  const removedDemo = await prisma.street.deleteMany({
    where: { municipalityId: municipality.id, osmId: null },
  });
  if (removedDemo.count > 0) {
    console.log(`Removidas ${removedDemo.count} ruas demo (sem OSM)`);
  }

  const streetCount = await prisma.street.count({
    where: { municipalityId: municipality.id, osmId: { not: null } },
  });
  if (streetCount === 0) {
    const bundled = await importStreetsFromBundledGeoJson(
      prisma,
      municipality.id,
      municipality.name,
      municipality.state,
    );
    if (bundled.imported > 0) {
      console.log(`Ruas locais carregadas: ${bundled.imported} (${bundled.path})`);
    }
  } else {
    console.log(`Ruas OSM já no banco: ${streetCount}`);
  }

  const municipality2 = await prisma.municipality.upsert({
    where: { name_state: { name: 'Pedreiras', state: 'MA' } },
    create: {
      name: 'Pedreiras',
      state: 'MA',
      prefecture: 'Prefeitura Municipal de Pedreiras',
      secretariat: 'Secretaria Municipal de Saúde',
      latitude: -4.5647,
      longitude: -44.5969,
    },
    update: {},
  });

  await prisma.user.upsert({
    where: { email: 'admin@pedreiras.ma.gov.br' },
    create: {
      email: 'admin@pedreiras.ma.gov.br',
      passwordHash,
      name: 'Admin Pedreiras',
      role: UserRole.ADMINISTRADOR,
      municipalityId: municipality2.id,
    },
    update: { passwordHash, municipalityId: municipality2.id, role: UserRole.ADMINISTRADOR },
  });

  await prisma.ubs.upsert({
    where: { id: '00000000-0000-4000-8000-000000000002' },
    create: {
      id: '00000000-0000-4000-8000-000000000002',
      name: 'UBS Central Pedreiras',
      address: 'Av. Principal, s/n — Centro',
      phone: '(99) 3651-0000',
      latitude: -4.5647,
      longitude: -44.5969,
      municipalityId: municipality2.id,
    },
    update: {},
  });

  console.log('Seed concluído!');
  console.log(`Município 1: ${municipality.name} (${municipality.id})`);
  console.log(`Município 2: ${municipality2.name} (${municipality2.id})`);
  console.log('Usuários: jonas@passagemfranca.ma.gov.br (enfermeiro) / admin@passagemfranca.ma.gov.br (admin) — Sigaps@2026');
  console.log('Pedreiras: admin@pedreiras.ma.gov.br (admin) — Sigaps@2026');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
