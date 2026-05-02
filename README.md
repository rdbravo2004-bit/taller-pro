# Taller Pro

Sistema de gestion de citas para taller mecanico.

## Stack

| Capa | Tecnologia |
|------|------------|
| Frontend | HTML / CSS / JS vanilla + FullCalendar |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) |
| IA | DeepSeek (via Edge Function) |
| Automatizacion | n8n + WhatsApp |

## Estructura

```
css/              Estilos
js/               Logica frontend (supabase, auth, helpers, particulas)
sql/              Esquema DB, seeds, triggers
edge-functions/   Supabase Edge Functions (whatsapp-webhook, daily-reminders, chat-ai)
n8n/              Workflows de automatizacion (JSON)
```

## Arranque local

```powershell
npx serve .
# Abrir http://localhost:XXXX/login.html
```

## Deploy

Los archivos estaticos se sirven via Cloudflare Pages desde este repo. Cada push a `main` redeploya automaticamente.

## Enlaces

- **Supabase Dashboard:** [supabase.com/dashboard](https://supabase.com/dashboard)
- **Edge Functions:** `https://glrveolwztjirwatdmyf.supabase.co/functions/v1/`
