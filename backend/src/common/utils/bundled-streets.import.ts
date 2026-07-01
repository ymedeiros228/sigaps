import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { PrismaClient } from '@prisma/client';
import {
  fixLineStringCoordinates,
  isValidBrazilCoord,
} from './geojson.util';

type StreetFeature = GeoJSON.Feature<
  GeoJSON.LineString,
  { osmId?: string; name?: string; highway?: string }
>;

const BATCH = 40;

function inferStreetType(name: string, highway?: string) {
  const lower = name.toLowerCase();
  if (lower.includes('avenida') || lower.startsWith('av ')) return 'Avenida';
  if (lower.includes('travessa') || lower.startsWith('tv ')) return 'Travessa';
  if (lower.includes('rodovia')) return 'Rodovia';
  if (highway === 'primary') return 'Via Principal';
  return 'Rua';
}

function bundledPath(municipalityName: string, state: string): string | null {
  const slug = `${municipalityName}-${state}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const candidates = [
    join(process.cwd(), 'assets', 'geo', `${slug}-streets.geojson`),
    join(process.cwd(), 'assets', 'geo', 'passagem-franca-streets.geojson'),
  ];

  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return null;
}

export async function importStreetsFromBundledGeoJson(
  prisma: PrismaClient,
  municipalityId: string,
  municipalityName: string,
  state: string,
) {
  const path = bundledPath(municipalityName, state);
  if (!path) {
    return { imported: 0, skipped: 0, total: 0, source: 'bundled' as const, path: null };
  }

  const raw = readFileSync(path, 'utf8');
  const geojson = JSON.parse(raw) as GeoJSON.FeatureCollection;
  const features = (geojson.features ?? []).filter(
    (f): f is StreetFeature =>
      f.type === 'Feature' &&
      f.geometry?.type === 'LineString' &&
      !!f.properties?.name?.trim(),
  );

  const toUpsert: Array<{
    osmId: bigint;
    name: string;
    streetType: string;
    municipalityId: string;
    geojson: { type: 'LineString'; coordinates: number[][] };
  }> = [];

  let skipped = 0;

  for (const feature of features) {
    const name = feature.properties.name!.trim();
    const osmIdRaw = feature.properties.osmId;
    if (!osmIdRaw) {
      skipped++;
      continue;
    }

    const coordinates = fixLineStringCoordinates(feature.geometry.coordinates);
    const [lng0, lat0] = coordinates[0];
    if (!isValidBrazilCoord(lng0, lat0)) {
      skipped++;
      continue;
    }

    toUpsert.push({
      osmId: BigInt(osmIdRaw),
      name,
      streetType: inferStreetType(name, feature.properties.highway),
      municipalityId,
      geojson: { type: 'LineString', coordinates },
    });
  }

  let imported = 0;
  for (let i = 0; i < toUpsert.length; i += BATCH) {
    const chunk = toUpsert.slice(i, i + BATCH);
    await prisma.$transaction(
      chunk.map((street) =>
        prisma.street.upsert({
          where: { osmId: street.osmId },
          create: street,
          update: {
            name: street.name,
            streetType: street.streetType,
            geojson: street.geojson,
          },
        }),
      ),
    );
    imported += chunk.length;
  }

  await prisma.street.deleteMany({
    where: { municipalityId, osmId: null },
  });

  return {
    imported,
    skipped,
    total: features.length,
    source: 'bundled' as const,
    path,
  };
}
