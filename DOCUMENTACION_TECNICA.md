# Documentación Técnica — Taller Pro (WhatsApp + n8n + Evolution API + DeepSeek)

> **Fecha:** 05/05/2026  
> **Versión:** v10 (bot funcional con memoria de conversación)

---

## 1. Arquitectura general

```
┌─────────────┐     ┌──────────────────┐     ┌──────────┐     ┌───────────────────┐     ┌─────────────┐
│  WhatsApp   │────▶│  Evolution API    │────▶│   n8n    │────▶│  Edge Function    │────▶│  DeepSeek   │
│  (cliente)  │     │  (Docker :8080)  │     │ (:5678)  │     │  (Supabase Cloud) │     │  (IA)       │
│             │◀────│                   │◀────│          │◀────│                   │◀────│             │
└─────────────┘     └──────────────────┘     └──────────┘     └───────────────────┘     └─────────────┘
                           │                                                                   
                           ▼                                                                   
                    ┌──────────────┐                                                           
                    │  PostgreSQL  │                                                           
                    │  (Docker)    │                                                           
                    └──────────────┘                                                           
```

**Flujo paso a paso:**
1. Cliente escribe a WhatsApp → WhatsApp servidores → Evolution API (Baileys)
2. Evolution API → webhook POST → n8n (`localhost:5678/webhook/whatsapp-webhook`)
3. n8n Code node → extrae phone/message/name → POST → Edge Function Supabase
4. Edge Function → consulta `message_log` (historial) → POST → DeepSeek API
5. DeepSeek responde → Edge Function → n8n → Evolution API → WhatsApp cliente

### URLs y credenciales

| Componente | URL | Auth |
|---|---|---|
| Frontend (prod) | `https://rdbmam.net` | Supabase Auth |
| Frontend (dev) | `http://localhost:3000` (`npx serve .`) | Supabase Auth |
| Supabase | `https://glrveolwztjirwatdmyf.supabase.co` | Anon key (ver abajo) |
| Edge Function `chat-ai` | `...supabase.co/functions/v1/chat-ai` | Bearer token |
| Edge Function `whatsapp-webhook` | `...supabase.co/functions/v1/whatsapp-webhook` | Bearer token |
| Edge Function `daily-reminders` | `...supabase.co/functions/v1/daily-reminders` | Bearer token |
| Evolution API | `http://localhost:8080` | apikey: `123456` |
| Evolution API Manager | `http://localhost:8080/manager/` | apikey: `123456` |
| n8n | `http://localhost:5678` | n8n account |
| DeepSeek API | `https://api.deepseek.com/chat/completions` | API key (en secrets) |

### Deploy

| Entorno | URL | Mecanismo |
|---|---|---|
| Producción | `https://rdbmam.net` | Cloudflare Pages — auto-deploy en cada `git push` a `master` |
| Desarrollo | `http://localhost:3000` | `npx serve .` (servidor estático local) |
| Repo GitHub | `https://github.com/rdbravo2004-bit/taller-pro` | — |

### Claves Supabase

```
URL:    https://glrveolwztjirwatdmyf.supabase.co
ANON:   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdscnZlb2x3enRqaXJ3YXRkbXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MjgwNjIsImV4cCI6MjA5MzEwNDA2Mn0.mzliyZzOUTFx0p79VatSSTpID6xkofyUW3vzn8dB4HI
SERVICE_ROLE: PENDIENTE (necesario para appointment-confirmation.json y daily-reminders)
```

---

## 2. Evolution API

### Instalación Docker

```powershell
# Red
docker network create evolution-net

# PostgreSQL (requerido por Evolution API v2.3.x)
docker run -d --name evolution-postgres --network evolution-net `
  -e POSTGRES_DB=evolution_api `
  -e POSTGRES_USER=evolution `
  -e POSTGRES_PASSWORD=evolution123 `
  postgres:15

# Evolution API v2.3.7 (imagen oficial: evoapicloud)
docker run -d --name evolution-api --network evolution-net -p 8080:8080 `
  -e AUTHENTICATION_TYPE=apikey `
  -e AUTHENTICATION_API_KEY=123456 `
  -e DATABASE_PROVIDER=postgresql `
  -e DATABASE_CONNECTION_URI="postgresql://evolution:evolution123@evolution-postgres:5432/evolution_api" `
  -e CACHE_REDIS_ENABLED=false `
  -e CACHE_LOCAL_ENABLED=true `
  -e SERVER_URL=http://localhost:8080 `
  -e LANGUAGE=es `
  evoapicloud/evolution-api:v2.3.7
```

### Versión e imagen

| Campo | Valor |
|---|---|
| **Imagen** | `evoapicloud/evolution-api:v2.3.7` |
| **Imagen anterior (descartada)** | `atendai/evolution-api:v1.7.0` |
| **Baileys** | `7.0.0-rc.9` (última disponible) |
| **Organización Docker** | `evoapicloud` (NO `atendai` — esa fue abandonada en v2.2.3) |
| **Homolog** | `evoapicloud/evolution-api:homolog` (build más reciente, abril 2026) |

### Comandos esenciales

```powershell
# Crear instancia
curl -X POST http://localhost:8080/instance/create `
  -H "apikey: 123456" -H "Content-Type: application/json" `
  -d '{"instanceName":"taller","integration":"WHATSAPP-BAILEYS","token":"taller-token"}'

# Conectar y obtener QR
curl -X GET "http://localhost:8080/instance/connect/taller" -H "apikey: 123456"

# Estado de conexión
curl -X GET "http://localhost:8080/instance/connectionState/taller" -H "apikey: 123456"

# Listar instancias
curl -X GET "http://localhost:8080/instance/fetchInstances" -H "apikey: 123456"

# Enviar mensaje
curl -X POST http://localhost:8080/message/sendText/taller `
  -H "apikey: 123456" -H "Content-Type: application/json" `
  -d '{"number":"5491168592944","text":"Hola desde Evolution API"}'

# Configurar webhook
curl -X POST "http://localhost:8080/webhook/set/taller" `
  -H "apikey: 123456" -H "Content-Type: application/json" `
  -d '{"webhook":{"enabled":true,"url":"http://host.docker.internal:5678/webhook/whatsapp-webhook","events":["MESSAGES_UPSERT"]}}'

# Ver webhooks
curl -X GET "http://localhost:8080/webhook/find/taller" -H "apikey: 123456"

# Eliminar instancia
curl -X DELETE "http://localhost:8080/instance/delete/taller" `
  -H "apikey: 123456" -H "Content-Type: application/json" -d '{"instanceName":"taller"}'

# Logs
docker logs evolution-api --tail 50
```

**Endpoint de envío desde n8n:** `http://127.0.0.1:8080/message/sendText/taller` (+ header `apikey: 123456`)

---

## 3. Vinculación WhatsApp

### Problema con v1.7.0 (error 428)

La imagen antigua `atendai/evolution-api:v1.7.0` usaba un Baileys muy viejo que se identificaba como **cliente web** (`Chrome`). Esto causaba:

- **Error 428** al escanear QR → "Precondition Required"
- **Conflicto de slot** con WhatsApp Web abierto
- **"No se pudo vincular el dispositivo"** en WhatsApp

### Solución: v2.3.7

`evoapicloud/evolution-api:v2.3.7` usa Baileys `7.0.0-rc.9` que implementa el protocolo **multi-dispositivo nativo** (como la app complementaria de WhatsApp). Ya no compite con WhatsApp Web.

### Proceso de vinculación

1. Crear instancia → obtener QR → escanear con WhatsApp (Ajustes → Dispositivos vinculados)
2. El QR expira en ~30 segundos. Si falla, regenerar y escanear inmediatamente.
3. Verificar con `docker logs evolution-api --tail 20` y `instance/connectionState` (debe mostrar `open`)

### Debug de conexión

```powershell
# Ver logs completos con más detalle
docker logs evolution-api --tail 100

# Si hay error 428 en logs:
# "Connection update received", "connection":"close", "statusCode":428
# Significa: WhatsApp rechazó el cliente. Causas:
# - Baileys desactualizado
# - IP bloqueada
# - Versión de WhatsApp incompatible
```

---

## 4. n8n Workflow `whatsapp-bot.json`

### Estructura final (v10)

```
┌──────────────┐     ┌──────────────────────┐
│   Webhook    │────▶│  Procesar mensaje     │
│ (recibe msg) │     │  (Code node)          │
└──────────────┘     │                       │
                     │ 1. Extrae phone/msg   │
                     │ 2. POST → Edge Func   │
                     │ 3. POST → Evolution   │
                     │ 4. Responde al webhook│
                     └──────────────────────┘
```

**Archivo:** `n8n/whatsapp-bot.json` → `v10.0.0`  
**Nodos:** 2 (webhook + code)  
**id:** `whatsapp-bot`

### Lógica del Code node

```javascript
// 1. Extraer datos del webhook
const input = $input.first().json;
const data = (input.body && input.body.data) || input.data || input;
const jid = (data.key && data.key.remoteJid) || '';
const phone = jid.includes('@') ? jid.split('@')[0] : jid;
const msg = data.message.conversation || '';
const name = data.pushName || 'Cliente';

// 2. Llamar Edge Function (DeepSeek)
await this.helpers.httpRequest({
  method: 'POST',
  url: 'https://glrveolwztjirwatdmyf.supabase.co/functions/v1/whatsapp-webhook',
  headers: { 'Authorization': 'Bearer ...', 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: msg, phone: phone, name: name })
});

// 3. Enviar respuesta por Evolution API
await this.helpers.httpRequest({
  method: 'POST',
  url: 'http://127.0.0.1:8080/message/sendText/taller',
  headers: { 'apikey': '123456', 'Content-Type': 'application/json' },
  body: JSON.stringify({ number: result.phone, text: result.reply })
});
```

### Evolución de versiones y errores encontrados

| Versión | Nodos | Error | Causa raíz |
|---|---|---|---|
| v1-v3 | 4 (Meta API) | 131030 | Token Meta expirado, número no verificado |
| v4 | 4 | `Error in workflow` | `bodyParameters` manda form-encoded, Edge Function espera JSON |
| v4.1 | 3 (sin Code) | `Error in workflow` | Mismo problema |
| v5 | 4 | `Error in workflow` | `jsonBody` NO evalúa templates `={{ }}` |
| v5.1 | 3 | `Bad request` en Evolution | Phone llegaba como template literal |
| v6 | 3 (fetch) | `fetch is not defined` | n8n sandbox no expone `fetch()` |
| v6.1 | 3 (helpers) | `400` de Edge Function | `jsonBody` seguía sin evaluar templates |
| v7 | 4 | `400` en Evolution | Template `.replace()` no se evalúa en `jsonBody` |
| v7.1 | 4 (rawBody) | `The service was not able...` | `rawBody` tampoco evalúa templates |
| v8 | 2 (todo en Code) | `400` de Evolution | Code node usaba `json: true` mal |
| v9 | 2 (https nativo) | `Module 'https' disallowed` | n8n sandbox bloquea `require('https')` |
| v9.1 | 2 (helpers) | `message` y `phone` vacíos | **Webhook envelope: datos en `body.body.data`, no en `body.data`** |
| **v10** | **2** | **FUNCIONA** | Extracción corregida |

---

## 5. Lecciones críticas n8n

> **REGLA #1:** Ante cualquier error en n8n, lo primero es ver la estructura real de datos.  
> `return { json: { rawBody: JSON.stringify($input.first().json) } }`  
> El 90% de los problemas están en cómo llegan los datos al nodo.

### El webhook envelope

n8n envuelve el POST body en un objeto:

```json
{
  "headers": {...},
  "params": {},
  "query": {},
  "body": {                    ← acá están los datos reales
    "event": "messages.upsert",
    "data": {
      "key": {"remoteJid": "54911..."},
      "pushName": "Cliente",
      "message": {"conversation": "hola"}
    }
  },
  "webhookUrl": "...",
  "executionMode": "production"
}
```

**Para acceder a los datos:** `$input.first().json.body.data.key.remoteJid`  
**NO:** `$input.first().json.data.key.remoteJid`

### Lo que NO funciona en n8n Code nodes

| Intento | Error | Alternativa |
|---|---|---|
| `JSON.stringify` + `jsonBody` en HTTP Request | Templates `={{ }}` no se evalúan | Usar Code node + `this.helpers.httpRequest()` |
| `fetch()` | `fetch is not defined` | Usar `this.helpers.httpRequest()` |
| `require('https')` | `Module 'https' is disallowed` | Usar `this.helpers.httpRequest()` |
| `bodyParameters` (form-encoded) | Edge Function espera JSON | Usar `JSON.stringify()` + string en body |
| `{ message: "={{ $json.x }}" }` en jsonBody | Se envía literal, no evaluado | Preparar el JSON en Code node |

### Lo que SÍ funciona

```javascript
// HTTP Request desde Code node — la única forma confiable
const response = await this.helpers.httpRequest({
  method: 'POST',
  url: 'https://...',
  headers: { 'Authorization': 'Bearer ...', 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: msg, phone: phone, name: name })
  // NOTA: NO usar json: true con body string. body ya es JSON string.
});
```

---

## 6. Edge Function `whatsapp-webhook`

### Deploy

```powershell
# CLI (requiere supabase login previo)
Copy-Item edge-functions\whatsapp-webhook supabase\functions\whatsapp-webhook -Recurse -Force
npx supabase functions deploy whatsapp-webhook

# O manual: Supabase Dashboard → Edge Functions → whatsapp-webhook → pegar código → Deploy
```

### Funcionalidades

1. **Proxy DeepSeek** — recibe mensaje, llama a DeepSeek, devuelve respuesta
2. **Historial de conversación** — antes de llamar a DeepSeek, consulta últimos 10 mensajes de `message_log` para ese número
3. **Crear citas** — detecta JSON de acción `create_appointment` y crea cliente/vehículo/servicio/cita en Supabase
4. **Consultar disponibilidad** — detecta `check_availability`, busca slots libres en `appointments`
5. **Consultar citas** — detecta `check_appointment`, busca citas por nombre/teléfono
6. **Registro** — guarda todos los mensajes (in/out) en `message_log`

### Historial de conversación (implementado 05/05/2026)

```typescript
// Se consultan los últimos 10 mensajes del message_log
const { data: history } = await supabase
  .from("message_log")
  .select("direction, message")
  .or(`sender.eq.${phone},recipient.eq.${phone}`)
  .order("created_at", { ascending: true })
  .limit(10);

// Se arma el array de mensajes para DeepSeek
const messages = [
  { role: "system", content: SYSTEM_PROMPT },
  // ... historial intercalado como user/assistant
  { role: "user", content: `Cliente: ${name}\nTeléfono: ${phone}\nMensaje: ${message}` }
];

// Llamada a DeepSeek con historial
body: JSON.stringify({ model: "deepseek-chat", messages, temperature: 0.7, max_tokens: 600 })
```

**`max_tokens`** aumentó de 400 a 600 para acomodar conversaciones más largas.

### Secrets requeridos

| Secret | Descripción |
|---|---|
| `DEEPSEEK_API_KEY` | API key de DeepSeek |
| `SUPABASE_URL` | `https://glrveolwztjirwatdmyf.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (bypass RLS para message_log) |

---

## 7. Comandos de referencia rápida

### Docker

```powershell
# Ver contenedores corriendo
docker ps

# Logs Evolution API
docker logs evolution-api --tail 50

# Reiniciar Evolution API
docker restart evolution-api

# Bajar todo
docker rm -f evolution-api evolution-postgres

# Limpiar volúmenes huérfanos
docker volume prune -f
```

### n8n

```powershell
# Iniciar n8n
cmd /c n8n start

# Webhook URL (cuando el workflow está activo)
http://localhost:5678/webhook/whatsapp-webhook

# Logs de ejecución
%USERPROFILE%\.n8n\n8nEventLog.log
```

### Test directo de componentes

```powershell
# Test Edge Function
Invoke-RestMethod -Uri "https://glrveolwztjirwatdmyf.supabase.co/functions/v1/whatsapp-webhook" `
  -Method Post -ContentType "application/json" `
  -Body '{"message":"hola","phone":"5491168592944","name":"Test"}' `
  -Headers @{ Authorization = "Bearer ANON_KEY" }

# Test Evolution API send
Invoke-RestMethod -Uri "http://localhost:8080/message/sendText/taller" `
  -Method Post -ContentType "application/json" `
  -Body '{"number":"5491168592944","text":"prueba"}' `
  -Headers @{ apikey = "123456" }

# Simular webhook de Evolution API a n8n
Invoke-RestMethod -Uri "http://localhost:5678/webhook/whatsapp-webhook" `
  -Method Post -ContentType "application/json" `
  -Body '{"event":"messages.upsert","data":{"key":{"remoteJid":"5491168592944@s.whatsapp.net"},"pushName":"Test","message":{"conversation":"hola"}}}'
```

### Estado de conexión WhatsApp

```powershell
# Ver si está conectado
curl http://localhost:8080/instance/connectionState/taller -H "apikey: 123456"
# Respuesta: {"instance":{"instanceName":"taller","state":"open"}}
# "open" = conectado | "close" = desconectado | "connecting" = esperando QR
```

---

## 8. Pendientes

### Alta prioridad

| Tarea | Archivo | Estado |
|---|---|---|
| Migrar `daily-reminders.json` de Meta → Evolution API | `n8n/daily-reminders.json` | Los nodos "Enviar WhatsApp" usan Meta (graph.facebook.com). Hay que reemplazar por Evolution API |
| Migrar `appointment-confirmation.json` de Meta → Evolution API | `n8n/appointment-confirmation.json` | Idem + placeholder `TU_SERVICE_ROLE_KEY_DE_SUPABASE` |
| Obtener `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API | Necesaria para daily-reminders y appointment-confirmation |

### Media prioridad

| Tarea | Descripción |
|---|---|
| Número de WhatsApp separado | Para producción, conseguir un chip/número dedicado al taller. Vincularlo a Evolution API como nueva instancia |
| WhatsApp Business API | Alternativa oficial de Meta (más estable, no viola ToS). Descartada por ahora debido a bloqueo de verificación |
| Mejorar `check_appointment` | El bot no busca bien citas por teléfono. Usar el phone del contexto en vez del query de DeepSeek |

### Baja prioridad

| Tarea | Descripción |
|---|---|
| Exponer Evolution API | Usar ngrok para que la Edge Function pueda llamar a Evolution API directamente (sin n8n) |
| Dashboard de mensajes | Mostrar message_log en el frontend de Taller Pro |

---

## 9. Evolución del proyecto

### Meta API → Evolution API

El plan original usaba la API oficial de Meta (WhatsApp Cloud API). Problemas:

- Token expiró (3 mayo 2026)
- Número de prueba `NOT_VERIFIED`
- Error 131030: "Recipient phone number not in allowed list"

**Solución:** Evolution API (Baileys) como alternativa sin depender de Meta.

### Ventajas de Evolution API

- No requiere verificación de Meta
- Sin límites de destinatarios
- Multi-dispositivo (no compite con WhatsApp Web)
- Open source, self-hosted

### Desventajas

- Viola ToS de WhatsApp (riesgo de baneo)
- Depende de Baileys (ingeniería inversa, puede romperse con updates de WhatsApp)
- Requiere Docker + PostgreSQL corriendo 24/7

---

*Documento generado el 05/05/2026 — Flujo WhatsApp Bot completamente funcional.*
