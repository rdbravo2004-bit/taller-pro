# Proyecto Talleres v0 — MVP Módulo Agenda y Citas

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Vanilla HTML/JS/CSS + `@supabase/supabase-js` (CDN) + FullCalendar (CDN) |
| Backend / API | Supabase (PostgreSQL + Auth + APIs automáticas) |
| Autenticación | Supabase Auth (magic link) |
| Automatización | n8n (WhatsApp bot, recordatorios, confirmaciones) |
| IA | DeepSeek API via Edge Function `chat-ai` |

## Tablas Supabase

| Tabla | Campos clave |
|-------|-------------|
| `profiles` | `id` (FK a auth.users), `role` (admin/operario), `full_name`, `phone`, `created_at` |
| `clients` | `id`, `full_name`, `phone`, `email`, `created_at` |
| `vehicles` | `id`, `client_id` (FK), `brand`, `model`, `year`, `license_plate`, `created_at` |
| `services` | `id`, `name`, `description`, `estimated_minutes`, `price`, `created_at` |
| `appointments` | `id`, `client_id` (FK), `vehicle_id` (FK), `service_id` (FK), `date`, `time`, `status`, `notes`, `created_at`, `created_by` |

### Estados de cita (`status`):
- `pending` — Pendiente de confirmación
- `confirmed` — Confirmada
- `in_progress` — En curso
- `completed` — Completada
- `cancelled` — Cancelada

### Estados de órdenes de trabajo (`orders`):
| Tabla | Campos clave |
|-------|-------------|
| `orders` | `id`, `appointment_id` (FK), `description`, `status`, `created_at`, `assigned_to` (FK profiles) |

- `pending`, `diagnosing`, `repairing`, `waiting_parts`, `completed`, `delivered`

## Edge Functions (Supabase)

| Función | Archivo | Descripción |
|---------|---------|-------------|
| `chat-ai` | `edge-functions/chat-ai/index.ts` | Proxy seguro DeepSeek. Recibe mensajes, valida sesión Supabase, llama a DeepSeek, devuelve respuesta. API key nunca sale del servidor. |
| `whatsapp-webhook` | `edge-functions/whatsapp-webhook/index.ts` | Procesa WhatsApp entrante: llama a DeepSeek, crea/consulta citas en Supabase, registra en message_log. |
| `daily-reminders` | `edge-functions/daily-reminders/index.ts` | Busca citas de mañana, genera notificaciones de recordatorio en tabla `notifications`. |

**Secrets requeridos (los 3 para todas las funciones):**
- `DEEPSEEK_API_KEY` — API key de DeepSeek
- `SUPABASE_URL` — URL del proyecto Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — service_role key de Supabase

## Pantallas (Frontend)

| Archivo | Descripción |
|---------|------------|
| `login.html` | Login con Supabase Auth |
| `dashboard.html` | Panel: citas del día, calendario, chat IA |
| `clients.html` | CRUD de clientes |
| `appointments.html` | CRUD de citas con filtros (fecha, cliente, estado) |

## Fases de Desarrollo

### Fase 1 — Supabase: Base de datos
1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ejecutar SQL inicial (`sql/01_schema.sql`)
3. Configurar Row Level Security
4. Crear datos de prueba (`sql/02_seed.sql`)

### Fase 2 — Login + Dashboard
1. `login.html` con Supabase Auth
2. `dashboard.html` con layout base
3. Integrar FullCalendar para vista de citas

### Fase 3 — Clientes + Citas CRUD
1. `clients.html` — Alta, baja, modificación, listado
2. `appointments.html` — CRUD con filtros

### Fase 4 — Agente IA (Doble canal)
1. Chat widget en dashboard (DeepSeek API)
2. Funciones: consultar disponibilidad, crear cita, consultar cita
3. Webhook n8n para WhatsApp entrante

### Fase 5 — n8n Workflows + Seguridad API Key

**Completado:**
1. Edge Function `chat-ai` — proxy seguro para DeepSeek, API key no viaja al frontend
2. `dashboard.html` usa la Edge Function en vez de llamada directa a DeepSeek
3. `config.js` limpio de secrets
4. SQL triggers y tablas de notificaciones (`sql/03_triggers.sql`)
5. Workflows n8n preparados (`n8n/`)

**Pendiente (Fase 5b — WhatsApp):**
1. Crear app en Meta Developers (WhatsApp Business API)
2. Deploy edge functions `whatsapp-webhook` y `daily-reminders`
3. Levantar n8n local + ngrok
4. Importar y configurar workflows
5. Probar bot WhatsApp, recordatorios, confirmaciones

### Dependencias externas (Fase 5b)
- Meta WhatsApp Business API credentials
- n8n (local con ngrok)
- ngrok

---

## Deploy

| Entorno | Plataforma | URL |
|---------|-----------|-----|
| Frontend (producción) | Cloudflare Pages | `https://rdbmam.net` |
| Frontend (desarrollo) | `npx serve .` | `http://localhost:XXXX` |
| Backend / DB | Supabase | `https://glrveolwztjirwatdmyf.supabase.co` |
| Edge Functions | Supabase | `...supabase.co/functions/v1/` |

**Flujo de deploy:**
```
git push → GitHub → Cloudflare Pages (auto-deploy) → rdbmam.net
```

**Supabase Auth config:**
- Site URL: `https://rdbmam.net`
- Redirect URLs: `https://rdbmam.net/**`

---

*Creado: 29/04/2026*
*Fase 5a completada: 02/05/2026 — Edge Function chat-ai, seguridad API key, deploy docs*
*Fase 5b pendiente: WhatsApp Bot + n8n workflows*
