# Estado actual — 05/05/2026 (fin de jornada)

## Lo que está funcionando

### Frontend
- Deployado en `https://rdbmam.net` (Cloudflare Pages) y `http://localhost:3000` (dev)
- Login/registro con Supabase Auth, formulario alineado a la derecha
- Dashboard con FullCalendar, stats (pendientes/confirmadas/completadas) y chat IA
- CRUD clientes, vehículos — completo
- CRUD citas con filtros (fecha, cliente, estado)
- CRUD servicios (admin-only, + vinculación a modelos de vehículo)
- CRUD repuestos (admin-only, con part_number, stock con colores, vinculación a modelos)
- CRUD modelos de vehículos (admin-only, 25 modelos seed + auto-create cuando cliente registra vehículo nuevo)
- Screensaver: efecto partículas tras 5 min de inactividad, cierra con cualquier tecla
- Configuración centralizada en `js/config.js` (nombre taller, dueño, teléfono, palabras screensaver)

### Supabase (DB + Edge Functions)

| Tabla | Estado |
|---|---|
| `clients`, `vehicles`, `services`, `appointments`, `orders` | Creadas con RLS |
| `parts` | Con `part_number` (alfanumérico 30 chars), `year_min`, `year_max`, `stock` |
| `vehicle_models` | 25 modelos seed (Ford, VW, Toyota, etc.) + trigger auto-create |
| `service_vehicles` | Relación servicio ↔ modelo |
| `part_vehicles` | Relación repuesto ↔ modelo |
| `order_parts` | Tracking de repuestos usados (order_id, part_id, quantity) |
| `notifications` | Cola de notificaciones (whatsapp/email) |
| `message_log` | Historial de conversaciones WhatsApp |

| Edge Function | Archivo | Estado |
|---|---|---|
| `chat-ai` | `edge-functions/chat-ai/index.ts` | Proxy DeepSeek seguro, CORS, valida sesión |
| `whatsapp-webhook` | `edge-functions/whatsapp-webhook/index.ts` | Procesa mensajes WhatsApp: historial (10 msg), DeepSeek, crea/consulta citas, registra en message_log, **fix reciente: check_appointment busca por teléfono del contexto** |
| `daily-reminders` | `edge-functions/daily-reminders/index.ts` | Busca citas de mañana, genera notificaciones de recordatorio |

### WhatsApp + n8n

| Componente | Estado |
|---|---|
| **Evolution API** | Docker local, `evoapicloud/evolution-api:v2.3.7`, puerto `8080`, WhatsApp vinculado (`open`), número `5491168592944` |
| **n8n** | Local `http://localhost:5678`, 3 workflows activos |
| **WhatsApp Bot** | v10 (2 nodos), historial de conversación, responde con DeepSeek |
| **Recordatorios Diarios** | Schedule 18:00 → Edge Function → Evolution API send |
| **Confirmación de Citas** | Schedule cada 5 min → fetch pending → Evolution API send → mark sent |

**Flujo completo validado:**
```
WhatsApp → Evolution API → n8n webhook → Edge Function (DeepSeek + historial) → Evolution API → WhatsApp respuesta
```

## DB relationships

```
services ── service_vehicles ── vehicle_models
parts    ── part_vehicles    ── vehicle_models
orders   ── order_parts      ── parts (quantity tracking)
```

## Manuales

| Archivo | Contenido |
|---|---|
| `MANUAL_PUESTA_EN_MARCHA.md` | Setup local paso a paso, backup, recuperación ante desastre, script de reconstrucción total, acceso a prod vs dev, troubleshooting |
| `MANUAL_USUARIO.md` | Guía para el dueño del taller: cómo usar cada pantalla, WhatsApp bot, roles |
| `MANUAL_DEPLOY_CLIENTE.md` | Deploy en nuevo dominio: Supabase, Cloudflare, VPS, DNS, script bash automatizado, check list de valores, informe de costos/riesgos |
| `MANUAL_ESCALABILIDAD.md` | Fase 1 (HTML) → Fase 2 (multi-tenant) → Fase 3 (React/TS SaaS), comparativa stacks, costos, cuándo migrar |
| `DOCUMENTACION_TECNICA.md` | Arquitectura completa, comandos Docker/n8n/Supabase, debugging n8n, lecciones aprendidas |

## Pendientes para mañana

| Tarea | Prioridad |
|---|---|
| **Desplegar EF `whatsapp-webhook` actualizada** (fix `check_appointment` con phone del contexto) | Alta |
| Probar a fondo la aplicación (manual, WhatsApp bot, citas, recordatorios) | Alta |
| Migrar Evolution API → Meta WhatsApp Cloud API (eliminar riesgo de baneo) | Media — diferido |
| Número de WhatsApp separado para el taller | Media — diferido |
