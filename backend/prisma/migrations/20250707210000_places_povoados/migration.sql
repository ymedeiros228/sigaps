-- Povoados e localidades rurais (complemento ao mapa OSM)
CREATE TYPE "PlaceKind" AS ENUM ('POVOADO', 'LOCALIDADE', 'DISTRITO');

CREATE TABLE "places" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PlaceKind" NOT NULL DEFAULT 'POVOADO',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "osm_node_id" BIGINT,
    "notes" TEXT,
    "municipality_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "places_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "places_osm_node_id_key" ON "places"("osm_node_id");
CREATE UNIQUE INDEX "places_name_municipality_id_key" ON "places"("name", "municipality_id");
CREATE INDEX "places_municipality_id_idx" ON "places"("municipality_id");

ALTER TABLE "places" ADD CONSTRAINT "places_municipality_id_fkey" FOREIGN KEY ("municipality_id") REFERENCES "municipalities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
