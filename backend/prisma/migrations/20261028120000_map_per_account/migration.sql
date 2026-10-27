-- Mapa próprio por conta: cada conta nova ganha uma cópia do mapa de quem a criou
-- (ruas, bairros, UBS e povoados, sem pintura). A cópia é um "município" com parent_id
-- apontando para o mapa de origem; a API já separa tudo por municipality_id.
-- Não mexe em nenhum dado existente: só acrescenta a coluna e troca regras únicas
-- globais por regras dentro do mesmo mapa (a mesma rua do OSM, o mesmo povoado e o
-- mesmo CPF de ACS podem existir em mapas diferentes).
-- Idempotente (IF EXISTS / IF NOT EXISTS): pode ser aplicada antes pelo MCP.

ALTER TABLE "municipalities" ADD COLUMN IF NOT EXISTS "parent_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'municipalities_parent_id_fkey'
  ) THEN
    ALTER TABLE "municipalities"
      ADD CONSTRAINT "municipalities_parent_id_fkey"
      FOREIGN KEY ("parent_id") REFERENCES "municipalities"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "municipalities_parent_id_idx" ON "municipalities"("parent_id");

-- Município: nome + UF deixa de ser único (as cópias têm o mesmo nome)
DROP INDEX IF EXISTS "municipalities_name_state_key";
CREATE INDEX IF NOT EXISTS "municipalities_name_state_idx" ON "municipalities"("name", "state");

-- Rua do OSM: única dentro do mapa
DROP INDEX IF EXISTS "streets_osm_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "streets_municipality_id_osm_id_key" ON "streets"("municipality_id", "osm_id");

-- Povoado do OSM: único dentro do mapa
DROP INDEX IF EXISTS "places_osm_node_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "places_municipality_id_osm_node_id_key" ON "places"("municipality_id", "osm_node_id");

-- CPF do ACS: único dentro do mapa
DROP INDEX IF EXISTS "acs_cpf_key";
CREATE UNIQUE INDEX IF NOT EXISTS "acs_municipality_id_cpf_key" ON "acs"("municipality_id", "cpf");
