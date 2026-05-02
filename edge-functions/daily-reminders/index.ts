// Supabase Edge Function: Daily Reminders
//
// Busca citas de mañana que estén pending/confirmed,
// genera notificaciones de recordatorio y devuelve la lista.
//
// Modo de uso:
//   - Llamado por n8n (Schedule trigger) todos los días a las 18:00
//   - O mediante Supabase pg_cron si está disponible
//
// Endpoint: POST /daily-reminders
// Body: {} (opcional, puede recibir { date: "YYYY-MM-DD" } para probar otra fecha)
//
// Deploy: supabase functions deploy daily-reminders
//         (o copiar este código al editor de Edge Functions en Supabase Dashboard)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const targetDate =
      body.date || new Date(Date.now() + 86400000).toISOString().split("T")[0];

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Buscar citas de la fecha objetivo
    const { data: appointments, error } = await supabase
      .from("appointments")
      .select(
        "id, date, time, status, client_id, service_id, vehicle_id, clients(full_name, phone), services(name), vehicles(brand, model)"
      )
      .eq("date", targetDate)
      .in("status", ["pending", "confirmed"]);

    if (error) throw error;

    if (!appointments?.length) {
      return new Response(
        JSON.stringify({
          reminders_generated: 0,
          date: targetDate,
          message: "No hay citas para recordar",
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Filtrar las que ya tienen recordatorio enviado hoy
    const { data: existingNotifications } = await supabase
      .from("notifications")
      .select("appointment_id")
      .eq("type", "whatsapp")
      .like("message", "Recordatorio:%")
      .gte("created_at", new Date().toISOString().split("T")[0]);

    const alreadyNotified = new Set(
      (existingNotifications || []).map((n) => n.appointment_id)
    );

    const toNotify = appointments.filter((a) => !alreadyNotified.has(a.id));

    // 3. Generar notificaciones
    const results: Array<{ phone: string; message: string; status: string }> = [];

    for (const appt of toNotify) {
      const phone = appt.clients?.phone;
      const clientName = appt.clients?.full_name || "Cliente";
      const serviceName = appt.services?.name || "servicio a confirmar";

      if (!phone) {
        results.push({
          phone: "—",
          message: `${clientName} sin teléfono`,
          status: "skipped",
        });
        continue;
      }

      const msg =
        `Recordatorio: mañana tenés una cita en Taller Pro.\n` +
        `Servicio: ${serviceName}\n` +
        `Horario: ${appt.time?.substring(0, 5)}\n` +
        `Por favor confirmá tu asistencia.`;

      const { error: notifError } = await supabase.from("notifications").insert({
        type: "whatsapp",
        recipient: phone,
        client_id: appt.client_id,
        appointment_id: appt.id,
        message: msg,
      });

      results.push({
        phone,
        message: msg.substring(0, 80) + "...",
        status: notifError ? "failed" : "pending",
      });
    }

    return new Response(
      JSON.stringify({
        reminders_generated: results.length,
        date: targetDate,
        results,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Reminders error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
