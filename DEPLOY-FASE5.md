# Guía de Deploy — Fase 5 (n8n + Edge Functions + WhatsApp)

## Paso 1: Ejecutar SQL en Supabase

Abrí [Supabase Dashboard](https://supabase.com/dashboard) → SQL Editor → pegá el contenido de `sql/03_triggers.sql` → **Run**.

Esto crea:
- Tabla `notifications` — cola de mensajes pendientes
- Tabla `message_log` — historial de mensajes
- Trigger que genera notificaciones automáticas cuando una cita se confirma
- Función RPC `generate_daily_reminders()` para generar recordatorios

---

## Paso 2: Deploy Edge Functions (WhatsApp Webhook)

### Requisitos
```powershell
npm install -g supabase
```

### Login y link al proyecto
```powershell
npx supabase login
npx supabase link --project-ref glrveolwztjirwatdmyf
```

### Configurar variables de entorno
```powershell
npx supabase secrets set DEEPSEEK_API_KEY=sk-902212ea7db7439ab76905647320de34

npx supabase secrets set SUPABASE_URL=https://glrveolwztjirwatdmyf.supabase.co

npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY
```

> La `SUPABASE_SERVICE_ROLE_KEY` la encontrás en Supabase Dashboard → Settings → API → `service_role` (es secreta, no la compartas).

### Preparar la estructura
```powershell
mkdir supabase\functions
copy edge-functions\whatsapp-webhook supabase\functions\whatsapp-webhook -Recurse
copy edge-functions\daily-reminders supabase\functions\daily-reminders -Recurse
```

### Deploy
```powershell
npx supabase functions deploy whatsapp-webhook
npx supabase functions deploy daily-reminders
```

### Verificar
```powershell
npx supabase functions list
```

Las URLs quedan:
- `https://glrveolwztjirwatdmyf.supabase.co/functions/v1/whatsapp-webhook`
- `https://glrveolwztjirwatdmyf.supabase.co/functions/v1/daily-reminders`

---

## Paso 3: Crear app en Meta for Developers (WhatsApp)

1. Entrá a [developers.facebook.com](https://developers.facebook.com)
2. Creá una app → tipo **Business**
3. Agregá producto **WhatsApp**
4. Anotá:
   - **Phone Number ID** (ej: 123456789)
   - **WhatsApp Business Account ID**
   - **Access Token** (token permanente generado en System Users)

5. Configurá el webhook:
   - Callback URL: `https://glrveolwztjirwatdmyf.supabase.co/functions/v1/whatsapp-webhook`
   - Verify token: el que quieras (para validación de Meta)
   - Suscribite a los eventos `messages`

---

## Paso 4: Instalar y configurar n8n

### Opción A — n8n.cloud (más fácil, pago)
Registrate en [n8n.cloud](https://n8n.cloud) y creá una instancia.

### Opción B — Self-hosted (gratis)
```powershell
npx n8n
```
Abrí `http://localhost:5678` y creá tu cuenta.

---

## Paso 5: Importar workflows en n8n

En n8n → **Import from file** → importá de a uno:

1. `n8n/whatsapp-bot.json`
2. `n8n/daily-reminders.json`
3. `n8n/appointment-confirmation.json`

### Reemplazar placeholders en cada workflow

En todos los workflows buscá y reemplazá:

| Placeholder | Valor real |
|-------------|------------|
| `TU_PROYECTO` | `glrveolwztjirwatdmyf` |
| `TU_ANON_KEY_DE_SUPABASE` | La anon key de Supabase (ya la tenés en `js/supabase.js`) |
| `TU_SERVICE_ROLE_KEY_DE_SUPABASE` | La service_role key de Supabase (Settings → API) |
| `TU_WHATSAPP_TOKEN` | El access token de Meta WhatsApp |
| `TU_PHONE_NUMBER_ID` | El Phone Number ID de Meta WhatsApp |

---

## Paso 6: Activar workflows

En cada workflow en n8n:
1. Verificá que los nodos estén verdes (sin errores)
2. Click en **Active** (toggle arriba a la derecha)
3. Probá con **Execute workflow** manualmente primero

---

## Flujo completo

```
Cliente escribe WhatsApp
  → Meta WhatsApp → n8n (whatsapp-bot)
    → Edge Function (whatsapp-webhook)
      → DeepSeek (procesa mensaje)
      → Supabase (crea/consulta cita)
    → Devuelve respuesta
  → n8n → Meta WhatsApp → Cliente recibe respuesta

Todos los días 18:00:
  n8n (daily-reminders)
    → Edge Function (daily-reminders)
      → Supabase (busca citas de mañana)
    → Para cada cita → WhatsApp

Cada 5 minutos:
  n8n (appointment-confirmation)
    → Supabase (busca notificaciones pendientes)
    → Para cada una → WhatsApp → Marca como enviada
```

---

## Troubleshooting

| Error | Causa probable |
|-------|---------------|
| Edge Function devuelve 500 | Revisá que las secrets estén configuradas (`supabase secrets list`) |
| WhatsApp no recibe mensajes | Token de Meta incorrecto o expirado. Regeneralo en Meta Developers |
| n8n workflow da error 401 en Supabase | Revisá la service_role key (no es la anon key) |
| El trigger SQL no genera notificaciones | Ejecutá en SQL Editor: `SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5;` para debuggear |
