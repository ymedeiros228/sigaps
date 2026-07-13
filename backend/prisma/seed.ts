import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { importStreetsFromBundledGeoJson } from '../src/common/utils/bundled-streets.import';
import { clearMunicipalityPaint } from '../src/common/utils/clear-municipality-paint.util';

const prisma = new PrismaClient();

function ensureMunicipalityLogo() {
  const src = join(process.cwd(), 'assets', 'logos', 'passagem-franca.png');
  const destDir = join(process.cwd(), 'uploads', 'logos');
  const dest = join(destDir, 'passagem-franca.png');
  if (!existsSync(src)) return;
  mkdirSync(destDir, { recursive: true });
  copyFileSync(src, dest);
}

const TEMPLATE_ACS = [
  { cpf: '11122233344', name: 'Ana Paula Santos', phone: '(99) 98888-0001', email: 'acs@passagemfranca.ma.gov.br' },
  { cpf: '22233344455', name: 'Carlos Eduardo Lima', phone: '(99) 98888-0002' },
  { cpf: '33344455566', name: 'Maria José Oliveira', phone: '(99) 98888-0003' },
  { cpf: '44455566677', name: 'Roberto Ferreira', phone: '(99) 98888-0004' },
  { cpf: '55566677788', name: 'Fernanda Costa', phone: '(99) 98888-0005' },
];

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

  for (let i = 0; i < TEMPLATE_ACS.length; i++) {
    const template = TEMPLATE_ACS[i];
    const acs = await prisma.acs.upsert({
      where: { cpf: template.cpf },
      create: {
        name: template.name,
        cpf: template.cpf,
        phone: template.phone,
        municipalityId: municipality.id,
        status: 'ATIVO',
      },
      update: { name: template.name, phone: template.phone, status: 'ATIVO' },
    });

    await prisma.microarea.update({
      where: { id: microareas[i].id },
      data: { ubsId: ubs.id, acsId: acs.id },
    });

    if (template.email) {
      const acsUser = await prisma.user.upsert({
        where: { email: template.email },
        create: {
          email: template.email,
          passwordHash,
          name: template.name,
          role: UserRole.ACS,
          municipalityId: municipality.id,
        },
        update: {
          passwordHash,
          municipalityId: municipality.id,
          role: UserRole.ACS,
          name: template.name,
        },
      });
      await prisma.acs.update({
        where: { id: acs.id },
        data: { userId: acsUser.id },
      });
    }
  }

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

  const cleared = await clearMunicipalityPaint(prisma, municipality.id);
  if (cleared.clearedStreets > 0 || cleared.clearedPaintZones > 0) {
    console.log(
      `Mapa zerado para entrega: ${cleared.clearedStreets} ruas e ${cleared.clearedPaintZones} círculos removidos`,
    );
  } else {
    console.log('Mapa já estava sem pintura — cadastros prontos para o usuário pintar.');
  }

  console.log('Seed concluído!');
  console.log(`Município: ${municipality.name} (${municipality.id})`);
  console.log('5 microáreas com ACS template vinculados (mapa zerado).');
  console.log('Usuários: jonas@passagemfranca.ma.gov.br (enfermeiro) / admin@passagemfranca.ma.gov.br (admin) — Sigaps@2026');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
