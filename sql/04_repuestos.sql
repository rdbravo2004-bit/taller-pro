-- ============================================================
-- Proyecto Talleres v0 — Repuestos (actualizado)
-- Ejecutar en SQL Editor de Supabase
-- Agrega part_number, year_min, year_max a la tabla parts
-- ============================================================

ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS part_number TEXT;
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS year_min INT;
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS year_max INT;

-- Validar part_number: alfanumérico, máx 30 caracteres
ALTER TABLE public.parts DROP CONSTRAINT IF EXISTS ck_part_number_format;
ALTER TABLE public.parts ADD CONSTRAINT ck_part_number_format
  CHECK (part_number IS NULL OR (length(part_number) <= 30 AND part_number ~ '^[A-Za-z0-9\-_\.]+$'));

-- Índice para búsqueda por número de parte
CREATE INDEX IF NOT EXISTS idx_parts_part_number ON public.parts(part_number);
