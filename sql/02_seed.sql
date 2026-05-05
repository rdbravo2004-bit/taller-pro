-- ============================================================
-- Proyecto Talleres v0 — Nuevos servicios (tren delantero/trasero)
-- Ejecutar en SQL Editor de Supabase
-- ============================================================

-- Borrar servicios viejos
DELETE FROM public.services;

-- Insertar nuevos servicios
INSERT INTO public.services (name, description, estimated_minutes, price) VALUES
  ('Diagnóstico computarizado', 'Scanner OBDII con informe completo', 45, 50.00),
  ('Alineación delantera', 'Alineación computarizada del tren delantero', 30, 40.00),
  ('Alineación integral 4 ruedas', 'Alineación total computarizada', 45, 65.00),
  ('Balanceo de neumáticos', 'Balanceo de 4 ruedas', 30, 25.00),
  ('Tren delantero completo', 'Inspección y reparación integral de tren delantero: rótulas, extremos, bujes, parrilla', 120, 180.00),
  ('Cambio de amortiguadores delanteros', 'Reemplazo de amortiguadores del tren delantero', 90, 120.00),
  ('Cambio de amortiguadores traseros', 'Reemplazo de amortiguadores traseros', 80, 100.00),
  ('Cambio de bujes de parrilla', 'Reemplazo de bujes de barra estabilizadora', 60, 70.00),
  ('Revisión de frenos', 'Inspección de pastillas, discos y líquido de frenos', 30, 30.00),
  ('Cambio de pastillas de freno', 'Reemplazo de pastillas y control de discos', 45, 55.00),
  ('Service de suspensión', 'Revisión y diagnóstico completo de sistema de suspensión', 60, 90.00),
  ('Reparación de rótulas y extremos', 'Cambio de rótulas y extremos de dirección', 60, 80.00),
  ('Cambio de rulemanes', 'Reemplazo de rulemanes de rueda (por unidad)', 75, 95.00);
