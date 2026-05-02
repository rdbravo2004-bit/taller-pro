-- ============================================================
-- Proyecto Talleres v0 — Datos de Prueba
-- Ejecutar después del schema
-- ============================================================

-- Servicios comunes de taller
INSERT INTO public.services (name, description, estimated_minutes, price) VALUES
  ('Cambio de aceite', 'Cambio de aceite y filtro', 30, 45.00),
  ('Alineación y balanceo', 'Alineación computarizada + balanceo de 4 ruedas', 60, 80.00),
  ('Diagnóstico computarizado', 'Scanner OBDII con informe completo', 45, 50.00),
  ('Revisión de frenos', 'Inspección de pastillas, discos y líquido', 30, 25.00),
  ('Cambio de neumáticos', 'Cambio de 4 neumáticos + válvulas', 60, 40.00),
  ('Service completo', 'Aceite, filtros, revisión general de 20 puntos', 120, 150.00),
  ('Aire acondicionado', 'Carga de gas y revisión de circuito', 60, 70.00),
  ('Reparación eléctrica', 'Diagnóstico y reparación eléctrica', 90, 120.00);

-- NOTA: Clientes, vehículos y citas se cargan desde la app.
-- Para pruebas rápidas podés insertar desde el frontend o desde el panel de Supabase.
