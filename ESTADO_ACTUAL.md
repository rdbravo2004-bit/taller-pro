# Estado actual — 05/05/2026

## Lo que está funcionando (Fases 1-5a)

- Frontend deployado en `https://rdbmam.net` (Cloudflare Pages)
- Supabase: DB, auth, RLS, seed data, triggers — todo OK
- Edge Function `chat-ai`: deployada y funcionando (proxy DeepSeek seguro)
- CRUD clientes, vehículos, citas — completo
- Dashboard con FullCalendar, stats y chat IA

## Phase 5b — WhatsApp (FUNCIONANDO)

### Meta API → Evolution API

La API oficial de Meta fue **descartada**. Motivos:
- Token expiró el 3/5/2026
- Número de prueba `+1 555-632-4268` con `code_verification_status: NOT_VERIFIED`
- Error 131030: "Recipient phone number not in allowed list"

**Reemplazo:** Evolution API v2.3.7 (Baileys 7.0.0-rc.9) corriendo en Docker local.

### Evolution API

| Campo | Valor |
|---|---|
| Imagen | `evoapicloud/evolution-api:v2.3.7` |
| Puerto | `8080` |
| Instancia | `taller` |
| API Key | `123456` |
| Estado WhatsApp | **open** (vinculado multi-dispositivo) |
| Número vinculado | `5491168592944` |
| Base de datos | PostgreSQL 15 (Docker `evolution-postgres`) |
| Manager | `http://localhost:8080/manager/` |

### Edge Functions

| Función | Archivo | Deployada | Estado |
|---|---|---|---|
| `chat-ai` | `edge-functions/chat-ai/index.ts` | Sí | Funcionando |
| `whatsapp-webhook` | `edge-functions/whatsapp-webhook/index.ts` | Sí | **v2 con historial de conversación** — consulta últimos 10 mensajes del `message_log` antes de llamar a DeepSeek |
| `daily-reminders` | `edge-functions/daily-reminders/index.ts` | ? | Escrita, no verificada |

### n8n — WhatsApp Bot

| Campo | Valor |
|---|---|
| Workflow | `n8n/whatsapp-bot.json` v10.0.0 |
| Nodos | 2 (webhook + code "Procesar mensaje") |
| Estado | **Activo y funcionando** |
| Webhook URL | `http://localhost:5678/webhook/whatsapp-webhook` |

**Flujo completo validado:**
```
WhatsApp → Evolution API → n8n webhook → Code node (extrae datos + llama EF + envía respuesta) → Edge Function (DeepSeek con historial) → Evolution API → WhatsApp respuesta
```

### n8n Workflows pendientes de migrar

| Workflow | Archivo | Estado |
|---|---|---|
| WhatsApp Bot | `whatsapp-bot.json` | Migrado a Evolution API |
| Daily Reminders | `daily-reminders.json` | Usa Meta API (`graph.facebook.com`). Hay que migrar a Evolution API |
| Appointment Confirmation | `appointment-confirmation.json` | Usa Meta API. Tiene placeholder `TU_SERVICE_ROLE_KEY_DE_SUPABASE` |

### Datos de Supabase

- URL: `https://glrveolwztjirwatdmyf.supabase.co`
- Anon key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdscnZlb2x3enRqaXJ3YXRkbXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MjgwNjIsImV4cCI6MjA5MzEwNDA2Mn0.mzliyZzOUTFx0p79VatSSTpID6xkofyUW3vzn8dB4HI`
- Service role key: **PENDIENTE** (necesaria para dos workflows de n8n)

### Lección crítica n8n

Ante cualquier error en n8n, **siempre ver primero la estructura de datos** que llega al nodo:
```javascript
return { json: { rawBody: JSON.stringify($input.first().json) } };
```
El webhook de n8n envuelve el POST en `{ headers, params, query, body: {...}, webhookUrl, executionMode }`. Los datos reales están en `$input.first().json.body.data`, no en `$input.first().json.data`.

### Documentación completa
Ver `DOCUMENTACION_TECNICA.md` para detalle de la arquitectura, comandos Docker, debugging n8n, y lecciones aprendidas.

## Próximos pasos

1. **Service role key** — obtenerla del Dashboard de Supabase
2. **Migrar daily-reminders.json** y **appointment-confirmation.json** de Meta → Evolution API
3. **Número separado** para el taller (producción)
4. **Deploy de daily-reminders** en Supabase
