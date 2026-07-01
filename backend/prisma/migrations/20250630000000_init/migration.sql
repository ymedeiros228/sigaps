-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMINISTRADOR', 'SECRETARIO_SAUDE', 'COORDENADOR_APS', 'ENFERMEIRO', 'ACS');

-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('ATIVO', 'INATIVO');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "municipality_id" TEXT,
    "refresh_token" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "municipalities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" VARCHAR(2) NOT NULL,
    "prefecture" TEXT NOT NULL,
    "secretariat" TEXT NOT NULL,
    "logo_url" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "municipalities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ubs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "coordinator" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "municipality_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "neighborhoods" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "municipality_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "neighborhoods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "microareas" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "color" VARCHAR(7) NOT NULL,
    "description" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'ATIVO',
    "ubs_id" TEXT,
    "municipality_id" TEXT NOT NULL,
    "acs_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "microareas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "phone" TEXT,
    "photo_url" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'ATIVO',
    "user_id" TEXT,
    "municipality_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streets" (
    "id" TEXT NOT NULL,
    "osm_id" BIGINT,
    "name" TEXT NOT NULL,
    "street_type" TEXT,
    "neighborhood_id" TEXT,
    "microarea_id" TEXT,
    "municipality_id" TEXT NOT NULL,
    "length_meters" DOUBLE PRECISION,
    "property_count" INTEGER NOT NULL DEFAULT 0,
    "family_count" INTEGER NOT NULL DEFAULT 0,
    "inhabitant_count" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "geojson" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "streets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "municipalities_name_state_key" ON "municipalities"("name", "state");

-- CreateIndex
CREATE UNIQUE INDEX "neighborhoods_name_municipality_id_key" ON "neighborhoods"("name", "municipality_id");

-- CreateIndex
CREATE UNIQUE INDEX "microareas_acs_id_key" ON "microareas"("acs_id");

-- CreateIndex
CREATE UNIQUE INDEX "microareas_number_municipality_id_key" ON "microareas"("number", "municipality_id");

-- CreateIndex
CREATE UNIQUE INDEX "acs_cpf_key" ON "acs"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "acs_user_id_key" ON "acs"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "streets_osm_id_key" ON "streets"("osm_id");

-- CreateIndex
CREATE INDEX "streets_municipality_id_idx" ON "streets"("municipality_id");

-- CreateIndex
CREATE INDEX "streets_microarea_id_idx" ON "streets"("microarea_id");

-- CreateIndex
CREATE INDEX "streets_name_idx" ON "streets"("name");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_municipality_id_fkey" FOREIGN KEY ("municipality_id") REFERENCES "municipalities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ubs" ADD CONSTRAINT "ubs_municipality_id_fkey" FOREIGN KEY ("municipality_id") REFERENCES "municipalities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "neighborhoods" ADD CONSTRAINT "neighborhoods_municipality_id_fkey" FOREIGN KEY ("municipality_id") REFERENCES "municipalities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "microareas" ADD CONSTRAINT "microareas_ubs_id_fkey" FOREIGN KEY ("ubs_id") REFERENCES "ubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "microareas" ADD CONSTRAINT "microareas_municipality_id_fkey" FOREIGN KEY ("municipality_id") REFERENCES "municipalities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "microareas" ADD CONSTRAINT "microareas_acs_id_fkey" FOREIGN KEY ("acs_id") REFERENCES "acs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acs" ADD CONSTRAINT "acs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acs" ADD CONSTRAINT "acs_municipality_id_fkey" FOREIGN KEY ("municipality_id") REFERENCES "municipalities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streets" ADD CONSTRAINT "streets_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "neighborhoods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streets" ADD CONSTRAINT "streets_microarea_id_fkey" FOREIGN KEY ("microarea_id") REFERENCES "microareas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streets" ADD CONSTRAINT "streets_municipality_id_fkey" FOREIGN KEY ("municipality_id") REFERENCES "municipalities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
