-- Empresas del grupo: nuevo nivel Empresa -> Ubicaciones.
-- Conserva los datos existentes: cada ubicación actual queda bajo una empresa con el nombre de su organización.

-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "erp_empresa_id" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- AlterTable (nullable mientras se rellena)
ALTER TABLE "ubicaciones" ADD COLUMN "empresa_id" TEXT;

-- Backfill: una empresa por organización existente (EMFIMIFAR hasta ahora) y se le cuelgan sus ubicaciones
INSERT INTO "empresas" ("id", "organizacion_id", "nombre")
SELECT 'emp-' || o."id", o."id", o."nombre" FROM "organizaciones" o;

UPDATE "ubicaciones" SET "empresa_id" = 'emp-' || "organizacion_id";

ALTER TABLE "ubicaciones" ALTER COLUMN "empresa_id" SET NOT NULL;

-- La organización pasa a ser el grupo (solo si conservaba el nombre que le puso el seed)
UPDATE "organizaciones" SET "nombre" = 'Grupo Metálico EMF' WHERE "nombre" = 'EMFIMIFAR';

-- DropIndex / CreateIndex: el nombre de una ubicación es único dentro de su empresa
DROP INDEX "ubicaciones_organizacion_id_nombre_key";

CREATE UNIQUE INDEX "empresas_organizacion_id_nombre_key" ON "empresas"("organizacion_id", "nombre");

CREATE UNIQUE INDEX "empresas_organizacion_id_erp_empresa_id_key" ON "empresas"("organizacion_id", "erp_empresa_id");

CREATE UNIQUE INDEX "ubicaciones_empresa_id_nombre_key" ON "ubicaciones"("empresa_id", "nombre");

-- AddForeignKey
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ubicaciones" ADD CONSTRAINT "ubicaciones_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
