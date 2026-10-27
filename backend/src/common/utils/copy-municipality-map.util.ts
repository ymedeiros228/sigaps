import type { Prisma } from '@prisma/client';

export type CopyMunicipalityMapResult = {
  id: string;
  streets: number;
};

/**
 * Mapa próprio de uma conta: cria um "município" novo (mesmo nome, `parent_id` = mapa de
 * origem) com cópia das ruas, bairros, UBS e povoados, sem pintura, microáreas nem ACS.
 * Só lê o mapa de origem: nada nele é alterado. A geometria da rua (`geom`) é preenchida
 * pelo gatilho `streets_geom_sync` a partir do `geojson`.
 */
export async function copyMunicipalityMap(
  tx: Prisma.TransactionClient,
  sourceId: string,
): Promise<CopyMunicipalityMapResult> {
  const source = await tx.municipality.findUniqueOrThrow({
    where: { id: sourceId },
  });
  const copy = await tx.municipality.create({
    data: {
      name: source.name,
      state: source.state,
      prefecture: source.prefecture,
      secretariat: source.secretariat,
      logoUrl: source.logoUrl,
      latitude: source.latitude,
      longitude: source.longitude,
      osmRelationId: source.osmRelationId,
      parentId: source.id,
    },
    select: { id: true },
  });

  await tx.$executeRaw`
    INSERT INTO "neighborhoods" ("id", "name", "municipality_id", "created_at", "updated_at")
    SELECT gen_random_uuid()::text, "name", ${copy.id}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM "neighborhoods"
    WHERE "municipality_id" = ${sourceId}`;

  await tx.$executeRaw`
    INSERT INTO "ubs" ("id", "name", "address", "phone", "coordinator", "cnes_code",
      "latitude", "longitude", "municipality_id", "created_at", "updated_at")
    SELECT gen_random_uuid()::text, "name", "address", "phone", "coordinator", "cnes_code",
      "latitude", "longitude", ${copy.id}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM "ubs"
    WHERE "municipality_id" = ${sourceId}`;

  await tx.$executeRaw`
    INSERT INTO "places" ("id", "name", "kind", "latitude", "longitude", "osm_node_id",
      "notes", "municipality_id", "created_at", "updated_at")
    SELECT gen_random_uuid()::text, "name", "kind", "latitude", "longitude", "osm_node_id",
      "notes", ${copy.id}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM "places"
    WHERE "municipality_id" = ${sourceId}`;

  // Bairro da rua: o da cópia com o mesmo nome. Contagens e anotações começam zeradas.
  const streets = await tx.$executeRaw`
    INSERT INTO "streets" ("id", "osm_id", "name", "street_type", "neighborhood_id",
      "municipality_id", "length_meters", "geojson", "created_at", "updated_at")
    SELECT gen_random_uuid()::text, s."osm_id", s."name", s."street_type", nc."id",
      ${copy.id}, s."length_meters", s."geojson", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM "streets" s
    LEFT JOIN "neighborhoods" ns ON ns."id" = s."neighborhood_id"
    LEFT JOIN "neighborhoods" nc
      ON nc."municipality_id" = ${copy.id} AND nc."name" = ns."name"
    WHERE s."municipality_id" = ${sourceId}`;

  return { id: copy.id, streets };
}
