-- ============================================================
-- Proyecto Talleres v0 — Triggers y notificaciones (Fase 5)
-- Ejecutar en SQL Editor de Supabase después del schema
-- ============================================================

-- 1. Tabla de notificaciones pendientes
-- n8n consulta esta tabla periódicamente para enviar mensajes
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('whatsapp', 'email')),
  recipient TEXT NOT NULL,           -- phone (WhatsApp) o email
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- RLS: autenticados leen y escriben notificaciones
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leen notificaciones"
  ON public.notifications FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados insertan notificaciones"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados actualizan notificaciones"
  ON public.notifications FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- 2. Tabla de log de mensajes enviados (histórico)
CREATE TABLE IF NOT EXISTS public.message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES public.notifications(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  sender TEXT,
  recipient TEXT NOT NULL,
  message TEXT NOT NULL,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leen message_log"
  ON public.message_log FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados insertan message_log"
  ON public.message_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- 3. Función: crear notificación cuando se confirma una cita
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_appointment_confirmation()
RETURNS TRIGGER AS $$
DECLARE
  client_phone TEXT;
  client_name TEXT;
  service_name TEXT;
  msg TEXT;
BEGIN
  -- Solo notificar si el estado cambió a 'confirmed'
  IF (TG_OP = 'INSERT' AND NEW.status = 'confirmed') OR
     (TG_OP = 'UPDATE' AND NEW.status = 'confirmed' AND OLD.status != 'confirmed') THEN

    -- Obtener datos del cliente
    SELECT c.phone, c.full_name INTO client_phone, client_name
    FROM public.clients c
    WHERE c.id = NEW.client_id;

    -- Obtener nombre del servicio
    SELECT s.name INTO service_name
    FROM public.services s
    WHERE s.id = NEW.service_id;

    -- Solo si tiene teléfono
    IF client_phone IS NOT NULL THEN
      msg := format(
        'Hola %s, tu cita en Taller Pro está CONFIRMADA.%sServicio: %s%sFecha: %s a las %s%s¡Te esperamos!',
        client_name,
        E'\n',
        COALESCE(service_name, 'A confirmar'),
        E'\n',
        NEW.date::TEXT,
        NEW.time::TEXT,
        E'\n'
      );

      INSERT INTO public.notifications (type, recipient, client_id, appointment_id, message)
      VALUES ('whatsapp', client_phone, NEW.client_id, NEW.id, msg);
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger en appointments
DROP TRIGGER IF EXISTS tr_appointment_confirmation ON public.appointments;
CREATE TRIGGER tr_appointment_confirmation
  AFTER INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_appointment_confirmation();

-- ============================================================
-- 4. Función: crear notificaciones de recordatorio diario
-- (se ejecuta vía pg_cron o llamada externa desde n8n)
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_daily_reminders()
RETURNS SETOF public.notifications AS $$
DECLARE
  tomorrow DATE := CURRENT_DATE + INTERVAL '1 day';
  appt RECORD;
  client_phone TEXT;
  client_name TEXT;
  service_name TEXT;
  msg TEXT;
  notif public.notifications;
BEGIN
  FOR appt IN
    SELECT a.id, a.client_id, a.vehicle_id, a.service_id, a.date, a.time
    FROM public.appointments a
    WHERE a.date = tomorrow
      AND a.status IN ('pending', 'confirmed')
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.appointment_id = a.id
          AND n.type = 'whatsapp'
          AND n.message LIKE 'Recordatorio:%'
          AND n.created_at::DATE = CURRENT_DATE
      )
  LOOP
    SELECT c.phone, c.full_name INTO client_phone, client_name
    FROM public.clients c WHERE c.id = appt.client_id;

    SELECT s.name INTO service_name
    FROM public.services s WHERE s.id = appt.service_id;

    IF client_phone IS NOT NULL THEN
      msg := format(
        'Recordatorio: mañana tenés una cita en Taller Pro.%sServicio: %s%sHorario: %s%sPor favor confirmá tu asistencia.',
        E'\n',
        COALESCE(service_name, 'A confirmar'),
        E'\n',
        appt.time::TEXT,
        E'\n'
      );

      INSERT INTO public.notifications (type, recipient, client_id, appointment_id, message)
      VALUES ('whatsapp', client_phone, appt.client_id, appt.id, msg)
      RETURNING * INTO notif;

      RETURN NEXT notif;
    END IF;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. Índices para notificaciones
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_client ON public.notifications(client_id);
CREATE INDEX IF NOT EXISTS idx_notifications_appointment ON public.notifications(appointment_id);
CREATE INDEX IF NOT EXISTS idx_message_log_created ON public.message_log(created_at);
