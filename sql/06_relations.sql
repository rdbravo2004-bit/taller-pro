-- ============================================================
-- Proyecto Talleres v0 — Relaciones Servicio/Repuesto ↔ Modelo
-- Ejecutar en SQL Editor de Supabase
-- ============================================================

-- 1. Servicios vinculados a modelos
CREATE TABLE IF NOT EXISTS public.service_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES public.vehicle_models(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(service_id, model_id)
);

ALTER TABLE public.service_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leen service_vehicles"
  ON public.service_vehicles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin inserta service_vehicles"
  ON public.service_vehicles FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Admin elimina service_vehicles"
  ON public.service_vehicles FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_sv_service ON public.service_vehicles(service_id);
CREATE INDEX IF NOT EXISTS idx_sv_model ON public.service_vehicles(model_id);

-- 2. Repuestos vinculados a modelos
CREATE TABLE IF NOT EXISTS public.part_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id UUID NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES public.vehicle_models(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(part_id, model_id)
);

ALTER TABLE public.part_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leen part_vehicles"
  ON public.part_vehicles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin inserta part_vehicles"
  ON public.part_vehicles FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Admin elimina part_vehicles"
  ON public.part_vehicles FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_pv_part ON public.part_vehicles(part_id);
CREATE INDEX IF NOT EXISTS idx_pv_model ON public.part_vehicles(model_id);

-- 3. Repuestos usados en órdenes de trabajo (tracking + cantidad)
CREATE TABLE IF NOT EXISTS public.order_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES public.parts(id) ON DELETE RESTRICT,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_id, part_id)
);

ALTER TABLE public.order_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leen order_parts"
  ON public.order_parts FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados insertan order_parts"
  ON public.order_parts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados actualizan order_parts"
  ON public.order_parts FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados eliminan order_parts"
  ON public.order_parts FOR DELETE
  USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_op_order ON public.order_parts(order_id);
CREATE INDEX IF NOT EXISTS idx_op_part ON public.order_parts(part_id);
