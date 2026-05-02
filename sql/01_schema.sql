-- ============================================================
-- Proyecto Talleres v0 — Esquema de Base de Datos
-- Ejecutar en SQL Editor de Supabase
-- ============================================================

-- 1. Tabla de perfiles (extiende auth.users de Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'operario' CHECK (role IN ('admin', 'operario')),
  full_name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'operario'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Clientes
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- 3. Vehículos
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INT,
  license_plate TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Servicios
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  estimated_minutes INT NOT NULL DEFAULT 60,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Citas / Turnos
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- 6. Órdenes de trabajo (para más adelante)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'diagnosing', 'repairing', 'waiting_parts', 'completed', 'delivered')),
  assigned_to UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Habilitar Row Level Security en todas las tablas
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Políticas RLS
-- ============================================================

-- Perfiles: cada uno ve el suyo, admin ve todos
CREATE POLICY "Usuarios ven su propio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admin ve todos los perfiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admin actualiza perfiles"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Clientes: todos los autenticados pueden leer, admin + operario pueden escribir
CREATE POLICY "Autenticados leen clientes"
  ON public.clients FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados insertan clientes"
  ON public.clients FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados actualizan clientes"
  ON public.clients FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados eliminan clientes"
  ON public.clients FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Vehículos
CREATE POLICY "Autenticados leen vehículos"
  ON public.vehicles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados insertan vehículos"
  ON public.vehicles FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados actualizan vehículos"
  ON public.vehicles FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados eliminan vehículos"
  ON public.vehicles FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Servicios: todos leen, admin escribe
CREATE POLICY "Autenticados leen servicios"
  ON public.services FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin inserta servicios"
  ON public.services FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admin actualiza servicios"
  ON public.services FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Citas: todos autenticados leen y escriben
CREATE POLICY "Autenticados leen citas"
  ON public.appointments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados insertan citas"
  ON public.appointments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados actualizan citas"
  ON public.appointments FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Órdenes
CREATE POLICY "Autenticados leen órdenes"
  ON public.orders FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados insertan órdenes"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados actualizan órdenes"
  ON public.orders FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Índices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone);
CREATE INDEX IF NOT EXISTS idx_vehicles_client ON public.vehicles(client_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON public.vehicles(license_plate);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_client ON public.appointments(client_id);
