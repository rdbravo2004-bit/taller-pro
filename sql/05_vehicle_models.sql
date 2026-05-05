-- ============================================================
-- Proyecto Talleres v0 — Modelos de vehículos
-- Ejecutar en SQL Editor de Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vehicle_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year_min INT,
  year_max INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(brand, model, year_min, year_max)
);

ALTER TABLE public.vehicle_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leen modelos"
  ON public.vehicle_models FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin inserta modelos"
  ON public.vehicle_models FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Admin actualiza modelos"
  ON public.vehicle_models FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Admin elimina modelos"
  ON public.vehicle_models FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_vehicle_models_brand ON public.vehicle_models(brand);
CREATE INDEX IF NOT EXISTS idx_vehicle_models_lookup ON public.vehicle_models(brand, model);

-- Seed: marcas y modelos comunes en Argentina
INSERT INTO public.vehicle_models (brand, model, year_min, year_max) VALUES
  ('Ford', 'Focus', 2010, 2025),
  ('Ford', 'Fiesta', 2010, 2024),
  ('Ford', 'Ranger', 2015, 2026),
  ('Ford', 'Ka', 2015, 2024),
  ('Ford', 'EcoSport', 2012, 2024),
  ('Volkswagen', 'Gol', 2008, 2023),
  ('Volkswagen', 'Voyage', 2008, 2023),
  ('Volkswagen', 'Polo', 2018, 2026),
  ('Volkswagen', 'Virtus', 2018, 2026),
  ('Volkswagen', 'Amarok', 2010, 2025),
  ('Toyota', 'Corolla', 2014, 2026),
  ('Toyota', 'Hilux', 2015, 2026),
  ('Toyota', 'Etios', 2013, 2024),
  ('Toyota', 'Yaris', 2019, 2026),
  ('Chevrolet', 'Cruze', 2016, 2024),
  ('Chevrolet', 'Onix', 2016, 2024),
  ('Chevrolet', 'Tracker', 2014, 2024),
  ('Renault', 'Sandero', 2010, 2025),
  ('Renault', 'Logan', 2010, 2025),
  ('Renault', 'Duster', 2012, 2024),
  ('Fiat', 'Cronos', 2018, 2026),
  ('Fiat', 'Argo', 2017, 2024),
  ('Peugeot', '208', 2012, 2026),
  ('Peugeot', '308', 2012, 2022),
  ('Peugeot', 'Partner', 2010, 2024)
ON CONFLICT (brand, model, year_min, year_max) DO NOTHING;

-- Trigger: auto-crear modelo cuando un cliente registra vehículo desconocido
CREATE OR REPLACE FUNCTION public.auto_create_vehicle_model()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.vehicle_models (brand, model, year_min, year_max)
  VALUES (NEW.brand, NEW.model, NEW.year, NEW.year)
  ON CONFLICT (brand, model, year_min, year_max) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_auto_vehicle_model ON public.vehicles;
CREATE TRIGGER tr_auto_vehicle_model
  AFTER INSERT ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_vehicle_model();
