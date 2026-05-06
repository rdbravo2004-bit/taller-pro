# Manual de Deploy para un Cliente — Taller Pro

> Cómo instalar el sistema en el taller de un cliente nuevo con su propio dominio, su propio WhatsApp y su propia base de datos.

---

## 1. Paso a paso

### Paso 1 — Fork del repositorio

```powershell
# 1. Crear un fork en GitHub desde https://github.com/rdbravo2004-bit/taller-pro
#    Ir al repo → botón Fork → elegir la cuenta de destino

# 2. Clonar el fork en tu PC
git clone https://github.com/TU_USUARIO/taller-cliente-nombre.git
Set-Location taller-cliente-nombre
```

### Paso 2 — Crear proyecto en Supabase

1. Entrá a [supabase.com/dashboard](https://supabase.com/dashboard)
2. **New project** → Nombre: `taller-cliente-nombre`
3. Elegir región más cercana al cliente
4. Esperar a que se cree (1-2 min)

### Paso 3 — Crear tablas en Supabase

1. Abrí el **SQL Editor** del nuevo proyecto
2. Ejecutá los siguientes archivos **en orden** (copiá y pegá cada uno):
   - `sql/01_schema.sql`
   - `sql/02_seed.sql`
   - `sql/03_triggers.sql`
   - `sql/04_repuestos.sql`
   - `sql/05_vehicle_models.sql`
   - `sql/06_relations.sql`

### Paso 4 — Configurar Supabase Auth

1. **Dashboard → Authentication → URL Configuration**
   - **Site URL:** `https://midominio.com` (el dominio del cliente)
   - **Redirect URLs:** `https://midominio.com/**`
2. **Dashboard → Settings → API** → Copiá:
   - **Project URL** (ej: `https://abcdefg.supabase.co`)
   - **anon public key**
   - **service_role key** (secreta)

### Paso 5 — Desplegar Edge Functions

Para cada función (`chat-ai`, `whatsapp-webhook`, `daily-reminders`):

1. **Dashboard → Edge Functions → Create a new function**
2. Nombre de la función (ej: `whatsapp-webhook`)
3. Pegar el código desde `edge-functions/<nombre>/index.ts`
4. **Deploy**
5. En **Settings → Secrets**, agregar estos 3 secrets:

```
DEEPSEEK_API_KEY = sk-XXXX (misma key de DeepSeek, o una nueva)
SUPABASE_URL = https://abcdefg.supabase.co (la URL del nuevo proyecto)
SUPABASE_SERVICE_ROLE_KEY = eyJ... (la service_role key del nuevo proyecto)
```

### Paso 6 — Configurar dominio con Cloudflare Pages

1. Entrá a [Cloudflare Pages](https://dash.cloudflare.com) → **Create a project**
2. Conectar al repositorio fork de GitHub
3. Configurar:
   - **Build command:** (dejar vacío, es HTML plano)
   - **Output directory:** (dejar vacío, es el root)
4. **Custom domain** → Agregar `taller.mecanica-aquiles.com` (o el dominio que quiera el cliente)
5. Esperar a que Cloudflare emita el certificado SSL

### Paso 7 — Actualizar credenciales en el código

Editar estos archivos **antes de pushear al repo del cliente:**

**`js/supabase.js`:**
```javascript
const SUPABASE_URL = 'https://abcdefg.supabase.co'; // ← URL del nuevo proyecto
const SUPABASE_ANON_KEY = 'eyJ...';                   // ← anon key del nuevo proyecto
```

**`js/config.js`:**
```javascript
const TALLER_CONFIG = {
  name: ['Aquiles', 'Suspensión'],       // ← nombre del taller cliente
  owner: {
    name: 'Juan Pérez',                   // ← nombre del dueño
    phone: '54911XXXXXXXX',               // ← teléfono del taller
  },
  screensaverMinutes: 5,
};
```

**`n8n/whatsapp-bot.json`** (actualizar en estos campos):
```json
// Authorization header del nodo "Llamar Edge Function"
"value": "Bearer <ANON_KEY_DEL_CLIENTE>"
```

**`n8n/daily-reminders.json`** y **`n8n/appointment-confirmation.json`** (reemplazar TODAS las ocurrencias):
```json
"apikey": "<SERVICE_ROLE_KEY_CLIENTE>"
"Authorization": "Bearer <SERVICE_ROLE_KEY_CLIENTE>"
```
Y cambiar `glrveolwztjirwatdmyf` por `abcdefg` (el nuevo project ref) en todas las URLs de Supabase.

### Paso 8 — Evolution API + WhatsApp del cliente

> **Nota:** El cliente necesita una PC prendida 24/7 para esto, o contratar un VPS (ver sección 2).

Ejecutar en la PC del cliente los mismos comandos de `MANUAL_PUESTA_EN_MARCHA.md`, sección 2, pasos 4-6:

```powershell
# Docker + Evolution API (mismos comandos)
docker network create evolution-net
docker run -d --name evolution-postgres --network evolution-net ...
docker run -d --name evolution-api --network evolution-net -p 8080:8080 ...

# Crear instancia y generar QR
Invoke-RestMethod http://localhost:8080/instance/create ...
Invoke-RestMethod http://localhost:8080/instance/connect/taller ...
```

**El dueño del taller escanea el QR con SU WhatsApp.** A partir de ese momento, el bot atiende en su número.

### Paso 9 — n8n en el cliente

1. En la PC del cliente, ejecutar `cmd /c n8n start`
2. Abrir `http://localhost:5678` → importar los 3 JSON de `n8n/` (ya actualizados en paso 7)
3. Activar los 3 workflows

### Paso 10 — Probar todo

| Prueba | ¿Qué verificar? |
|---|---|
| Abrir `https://midominio.com/login.html` | Carga el login, el formulario está a la derecha, las partículas de fondo andan |
| Registrarse | Crear cuenta de admin para el dueño |
| Dashboard | Carga el calendario, stats en 0 |
| WhatsApp | Mandar un mensaje al número del dueño → el bot responde solo |
| Cita por WhatsApp | Decir "quiero agendar" → el bot pide datos → crea la cita → se ve en el calendario |

---

## 2. Check list de valores a reemplazar

| Archivo | Campo | Valor actual | → Nuevo valor |
|---|---|---|---|
| `js/supabase.js` | `SUPABASE_URL` | `glrveolwztjirwatdmyf` | URL del nuevo proyecto |
| `js/supabase.js` | `SUPABASE_ANON_KEY` | `eyJ...` | Anon key del nuevo proyecto |
| `js/config.js` | `TALLER_CONFIG.name` | `['Taller', 'Pro']` | Nombre del taller |
| `js/config.js` | `TALLER_CONFIG.owner` | Roberto Bravo / 5491168592944 | Datos del dueño |
| Edge Functions | 3 secrets | (ver paso 5) | Nuevas credenciales |
| `n8n/*.json` | Authorization, apikey | Keys actuales | Keys del nuevo proyecto |
| `n8n/*.json` | URLs de Supabase | `glrveolwztjirwatdmyf` | `abcdefg` (nuevo project ref) |

---

## 3. Informe de servicios comprometidos

### 3.1 Costos, riesgos y limitaciones de cada servicio

| Servicio | Versión | Límite free | ¿Necesita pago? | Costo pago (aprox) | ¿Riesgo de clavarse? |
|---|---|---|---|---|---|
| **Cloudflare Pages** | Free | 500 builds/mes, 100MB/sitio | No | Pro: $20/mes si se excede | **Bajo** — lo free alcanza de sobra |
| **Supabase** | Free (2 proyectos) | 500MB DB, 2GB bandwidth, 50K usuarios | **Sí, al crecer** | **Pro: $25/mes** (8GB DB, 50GB BW, 100K usuarios) | **Medio** — 500MB se llena si el taller tiene mucho volumen de message_log. Con 1 taller chico, free alcanza. Con +3 clientes, Pro necesario |
| **GitHub** | Free | Ilimitado para repos privados | No | Teams: $4/usuario/mes | **No** |
| **Evolution API** | **Open source** | Sin límites de mensajes | No | $0 | **ALTO** — Viola ToS de WhatsApp. Riesgo de baneo del número del cliente. No hay versión paga que lo evite. Alternativa oficial: Meta WhatsApp Cloud API (ver abajo) |
| **n8n (self-hosted)** | Free | Sin límites de ejecuciones | Opcional | $0 self-hosted / n8n.cloud $20/mes | **Medio** — La PC del cliente DEBE estar prendida 24/7. Si se apaga, no hay WhatsApp bot ni recordatorios. Alternativa profesional: n8n.cloud o VPS |
| **DeepSeek API** | Pago por uso | N/A | **Sí, siempre** | **$0.14/1M tokens in, $0.28/1M tokens out** | **Bajo** — Muy barato. ~$0.0005 por conversación de 5 mensajes. $5 duran ~10,000 conversaciones |
| **Meta WhatsApp Cloud API** | Free (1000 conv/mes) | 1000 conversaciones/mes gratis | Al exceder 1000 | $0.005-$0.08/conv extra | **Medio** — Es la alternativa OFICIAL a Evolution API. Elimina el riesgo de baneo. Pero requiere verificación de Meta (más complejo de configurar) |

### 3.2 ¿Sirve cada servicio para más de un cliente?

| Servicio | ¿Compartible? | Cómo |
|---|---|---|
| **Cloudflare Pages** | **No** — 1 proyecto por dominio | Cada cliente tiene su propio proyecto (gratis) |
| **Supabase Pro ($25)** | **Sí** | Una DB con `tenant_id` por cliente. RLS aísla los datos. Un solo Pro aloja 10-15 clientes |
| **GitHub** | **Sí** | Un solo repo multi-tenant, o repos separados (todos free) |
| **Evolution API** | **Sí** (con matices) | Una instancia Docker por número de WhatsApp. Si cada cliente usa SU número, necesita su propia instancia. Mismo VPS puede correr varias |
| **n8n** | **Sí** | Una instancia maneja workflows de múltiples clientes (subflujos por tenant) |
| **DeepSeek** | **Sí** | Misma API key para todos. Se factura por uso total |
| **VPS (Hetzner $6/mes)** | **Sí** | Mismo VPS corre Docker (Evolution API) + n8n para todos los clientes |

### 3.3 Costo mensual estimado por cantidad de clientes

| Escenario | Clientes | Servicios | Costo/mes total | Costo/cliente |
|---|---|---|---|---|
| **Mínimo** | 1 | Cloudflare Free + Supabase Free + GitHub Free + Evolution (local) + n8n (local) + DeepSeek | **~$3** | $3 |
| **Recomendado** | 3 | Cloudflare Free x3 + Supabase Pro ($25) + VPS Hetzner ($10) + DeepSeek (~$10) | **~$45** | $15 |
| **Profesional** | 10 | Ídem + n8n.cloud ($20) o VPS mejor ($20) + DeepSeek (~$30) | **~$95** | $9.50 |
| **Con Meta oficial** | 3 | Ídem recomendado + Meta API (~$20-40 según volumen) | **~$85** | $28 |

### 3.4 Riesgos específicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| WhatsApp banea el número por usar Evolution API | **Media** (WhatsApp mejora detección) | **Crítico** (cliente pierde WhatsApp temporalmente) | Migrar a Meta WhatsApp Cloud API (oficial) ni bien sea viable |
| La PC del cliente se apaga de noche | **Alta** (cortes de luz, actualizaciones) | **Alto** (no hay bot ni recordatorios hasta que reinicie) | Contratar VPS ($10/mes Hetzner) para correr Evolution + n8n 24/7 |
| Supabase Free se llena | **Media** (según volumen) | **Medio** (si se llena, las citas no se guardan) | Monitorear uso. Migrar a Pro ($25/mes) antes de llegar al límite |
| DeepSeek deja de funcionar | **Baja** (es API paga con SLA) | **Alto** (el bot no responde) | Tener crédito cargado. Alternativa: OpenAI (más caro pero más estable) |
| n8n se rompe con una actualización | **Baja** | **Medio** (se arregla reseteando) | No actualizar n8n sin probar primero. Tener backup de los workflows JSON |

---

## 4. Dominios y DNS

### Configuración típica de DNS para el cliente

| Tipo | Nombre | Valor |
|---|---|---|
| CNAME | `taller` | `taller-cliente.pages.dev` (Cloudflare Pages) |
| CNAME | `www` | `taller-cliente.pages.dev` |

> El cliente compra el dominio en su registrador habitual (GoDaddy, Namecheap, DonWeb) y apunta los DNS a Cloudflare. Todo el proceso de SSL es automático.

---

*Documento creado como parte de Taller Pro. Actualizado a mayo 2026.*
