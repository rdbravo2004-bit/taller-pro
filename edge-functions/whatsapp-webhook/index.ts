// Supabase Edge Function: WhatsApp Webhook
//
// Recibe mensajes de WhatsApp (vía n8n), los procesa con DeepSeek,
// y ejecuta acciones en Supabase (crear cliente, crear cita, consultar).
//
// Endpoint: POST /whatsapp-webhook
// Body: { message: string, phone: string, name?: string }
//
// Deploy: supabase functions deploy whatsapp-webhook
//         (o copiar este código al editor de Edge Functions en Supabase Dashboard)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEEPSEEK_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `Sos el asistente virtual de Taller Pro, un taller mecánico. Ayudás a clientes por WhatsApp.

DATOS DEL TALLER:
Servicios: Cambio de aceite ($45, 30min), Alineación y balanceo ($80, 60min), Diagnóstico computarizado ($50, 45min), Revisión de frenos ($25, 30min), Cambio de neumáticos ($40, 60min), Service completo ($150, 120min), Aire acondicionado ($70, 60min), Reparación eléctrica ($120, 90min).
Horario: lunes a viernes 8:00-18:00, sábados 8:00-13:00.

FORMATO DE RESPUESTA:
Respondé en español, tono amable y profesional, mensajes cortos (máx 3 oraciones).

Cuando el cliente QUIERE CREAR UNA CITA, respondé ÚNICAMENTE con este JSON (sin texto adicional):
{"action":"create_appointment","data":{"full_name":"nombre del cliente","phone":"teléfono","vehicle_brand":"marca","vehicle_model":"modelo","service":"servicio solicitado","preferred_date":"YYYY-MM-DD","preferred_time":"HH:MM"}}

Cuando el cliente QUIERE CONSULTAR DISPONIBILIDAD, respondé ÚNICAMENTE con este JSON:
{"action":"check_availability","data":{"date":"YYYY-MM-DD"}}

Cuando el cliente QUIERE CONSULTAR SU CITA, respondé ÚNICAMENTE con este JSON:
{"action":"check_appointment","data":{"query":"nombre o fecha"}}

En cualquier otro caso (saludos, preguntas generales, etc.), respondé con texto normal, no JSON.`;

interface WebhookRequest {
  message: string;
  phone: string;
  name?: string;
}

interface DeepSeekResponse {
  choices: Array<{ message: { content: string } }>;
}

interface ActionResponse {
  action: string;
  data: Record<string, string>;
}

function extractJSON(text: string): ActionResponse | null {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}") + 1;
    if (start !== -1 && end > start) {
      return JSON.parse(text.slice(start, end));
    }
  } catch {
    // No es JSON, es respuesta de texto normal
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    let body: WebhookRequest = await req.json();
    if (body.parameters) {
      body = body.parameters as unknown as WebhookRequest;
    }
    if (!body.message && body.body) {
      body.message = typeof body.body === "string" ? body.body : (body.body as Record<string,string>).message || "";
    }
    let { message, phone, name } = body;
    phone = phone.replace(/^\+/, "");

    if (!message?.trim() || !phone?.trim()) {
      return new Response(
        JSON.stringify({ error: "message y phone son requeridos" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 1. Llamar a DeepSeek
    const dsResponse = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Cliente: ${name || phone}\nTeléfono: ${phone}\nMensaje: ${message}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 400,
      }),
    });

    if (!dsResponse.ok) {
      throw new Error(`DeepSeek error ${dsResponse.status}`);
    }

    const dsData: DeepSeekResponse = await dsResponse.json();
    const reply = dsData.choices[0].message.content;

    // 2. Detectar si la respuesta es una acción (JSON)
    const action = extractJSON(reply);

    // 3. Inicializar cliente Supabase (service_role para bypass RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 4. Registrar mensaje entrante
    await supabase.from("message_log").insert({
      direction: "incoming",
      channel: "whatsapp",
      sender: phone,
      recipient: "Taller Pro",
      message: message,
    });

    if (action?.action === "create_appointment") {
      // ─── Crear cita ───
      const d = action.data;
      const serviceMap: Record<string, string> = {
        "cambio de aceite": "Cambio de aceite",
        "cambio aceite": "Cambio de aceite",
        alineación: "Alineación y balanceo",
        "alineación y balanceo": "Alineación y balanceo",
        "diagnóstico computarizado": "Diagnóstico computarizado",
        "diagnostico computarizado": "Diagnóstico computarizado",
        "revisión de frenos": "Revisión de frenos",
        "revision de frenos": "Revisión de frenos",
        "cambio de neumáticos": "Cambio de neumáticos",
        "cambio de neumaticos": "Cambio de neumáticos",
        "service completo": "Service completo",
        "aire acondicionado": "Aire acondicionado",
        "reparación eléctrica": "Reparación eléctrica",
        "reparacion electrica": "Reparación eléctrica",
      };

      const serviceName = d.service?.toLowerCase().trim();
      const matchedService = Object.entries(serviceMap).find(([key]) =>
        serviceName?.includes(key)
      );

      // Buscar o crear cliente
      let { data: existingClients } = await supabase
        .from("clients")
        .select("id")
        .or(`phone.eq.${d.phone},full_name.ilike.${d.full_name}`)
        .limit(1);

      let clientId = existingClients?.[0]?.id;

      if (!clientId) {
        const { data: newClient } = await supabase
          .from("clients")
          .insert({ full_name: d.full_name, phone: d.phone })
          .select("id")
          .single();
        clientId = newClient?.id;
      }

      if (!clientId) {
        throw new Error("No se pudo crear/encontrar el cliente");
      }

      // Buscar o crear vehículo
      let { data: existingVehicles } = await supabase
        .from("vehicles")
        .select("id")
        .eq("client_id", clientId)
        .ilike("brand", d.vehicle_brand)
        .ilike("model", d.vehicle_model)
        .limit(1);

      let vehicleId = existingVehicles?.[0]?.id;

      if (!vehicleId && d.vehicle_brand && d.vehicle_model) {
        const { data: newVehicle } = await supabase
          .from("vehicles")
          .insert({
            client_id: clientId,
            brand: d.vehicle_brand,
            model: d.vehicle_model,
          })
          .select("id")
          .single();
        vehicleId = newVehicle?.id;
      }

      // Buscar servicio
      let serviceId: string | null = null;
      if (matchedService) {
        const { data: svc } = await supabase
          .from("services")
          .select("id")
          .ilike("name", `%${matchedService[1]}%`)
          .limit(1);
        serviceId = svc?.[0]?.id || null;
      }

      // Crear cita
      const { error: aptError } = await supabase.from("appointments").insert({
        client_id: clientId,
        vehicle_id: vehicleId || null,
        service_id: serviceId,
        date: d.preferred_date || new Date().toISOString().split("T")[0],
        time: d.preferred_time || "09:00",
        status: "pending",
        notes: `Creada vía WhatsApp por ${d.full_name}`,
      });

      if (aptError) throw aptError;

      const confirmationMsg = `¡Listo ${d.full_name}! Tu cita fue registrada.${
        d.preferred_date ? `\nFecha: ${d.preferred_date}` : ""
      }${d.preferred_time ? ` a las ${d.preferred_time}` : ""}\nTe confirmamos el turno a la brevedad.`;

      await supabase.from("message_log").insert({
        direction: "outgoing",
        channel: "whatsapp",
        recipient: phone,
        message: confirmationMsg,
        raw_payload: action,
      });

      return new Response(JSON.stringify({ reply: confirmationMsg, phone, action: "created" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (action?.action === "check_availability") {
      // ─── Consultar disponibilidad ───
      const date = action.data.date || new Date().toISOString().split("T")[0];
      const { data: appointments, count } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: false })
        .eq("date", date)
        .neq("status", "cancelled");

      const busyHours = (appointments || []).map((a) => a.time?.substring(0, 5));
      const availableSlots = [
        "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
        "11:00", "11:30", "14:00", "14:30", "15:00", "15:30",
        "16:00", "16:30", "17:00",
      ].filter((slot) => !busyHours.includes(slot));

      const availText =
        availableSlots.length > 0
          ? `Para el ${date} hay ${availableSlots.length} horarios disponibles. Los primeros: ${availableSlots.slice(0, 5).join(", ")}. ¿Querés reservar alguno?`
          : `El ${date} está completo. ¿Probamos otro día?`;

      return new Response(JSON.stringify({ reply: availText, phone, action: "availability" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (action?.action === "check_appointment") {
      // ─── Consultar cita del cliente ───
      const query = action.data.query;
      const { data: matchingClients } = await supabase
        .from("clients")
        .select("id")
        .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(3);

      if (!matchingClients?.length) {
        const notFoundMsg = "No encontré citas con ese dato. ¿Me pasás tu nombre completo o teléfono?";
        return new Response(JSON.stringify({ reply: notFoundMsg, phone }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      const clientIds = matchingClients.map((c) => c.id);
      const { data: appointments } = await supabase
        .from("appointments")
        .select("date, time, status, services(name), vehicles(brand, model)")
        .in("client_id", clientIds)
        .order("date", { ascending: false })
        .limit(3);

      if (!appointments?.length) {
        const noApptMsg = "No tenés citas registradas. ¿Querés sacar un turno?";
        return new Response(JSON.stringify({ reply: noApptMsg, phone }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      const apptList = appointments
        .map(
          (a) =>
            `${a.date} ${a.time?.substring(0, 5)} — ${a.services?.name || "Sin servicio"} (${statusLabel(a.status)})`
        )
        .join("\n");

      const apptMsg = `Tus citas:\n${apptList}`;
      return new Response(JSON.stringify({ reply: apptMsg, phone, action: "appointment_list" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ─── Respuesta normal (texto) ───
    await supabase.from("message_log").insert({
      direction: "outgoing",
      channel: "whatsapp",
      recipient: phone,
      message: reply,
    });

    return new Response(JSON.stringify({ reply, phone }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Pendiente",
    confirmed: "Confirmada",
    in_progress: "En curso",
    completed: "Completada",
    cancelled: "Cancelada",
  };
  return labels[status] || status;
}
