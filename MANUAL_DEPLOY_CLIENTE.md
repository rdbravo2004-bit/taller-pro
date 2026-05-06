# Manual de Deploy para un Cliente — Taller Pro

> Cómo instalar el sistema COMPLETO en el taller de un cliente nuevo: su propio dominio, su propio WhatsApp, su propia base de datos, y corriendo 24/7 en un VPS.

---

## 1. Paso a paso — Deploy completo

### Paso 1 — Fork del repositorio

1. Entrá a [github.com/rdbravo2004-bit/taller-pro](https://github.com/rdbravo2004-bit/taller-pro)
2. Botón **Fork** (arriba a la derecha) → elegí tu cuenta
3. Clonar el fork:

```powershell
git clone https://github.com/TU_USUARIO/taller-cliente-nombre.git
Set-Location taller-cliente-nombre
```

### Paso 2 — Crear proyecto en Supabase

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. **Nombre:** `taller-cliente-nombre` (ej: `taller-aquiles`)
3. **Database Password:** generá una segura y **guardala** (la vas a necesitar para el connection string)
4. **Región:** la más cercana al cliente (South America si está disponible)
5. Esperar 1-2 minutos a que se cree

### Paso 3 — Crear todas las tablas

1. **Dashboard → SQL Editor → New query**
2. Ejecutá estos archivos **en orden** (copiá y pegá cada uno):

| # | Archivo | Qué crea |
|---|---|---|
| 1 | `sql/01_schema.sql` | Tablas: profiles, clients, vehicles, services, appointments, orders + RLS |
| 2 | `sql/02_seed.sql` | 13 servicios de tren delantero/trasero |
| 3 | `sql/03_triggers.sql` | Tablas: notifications, message_log + trigger de confirmación |
| 4 | `sql/04_repuestos.sql` | Tabla parts con part_number, year_min, year_max |
| 5 | `sql/05_vehicle_models.sql` | Tabla vehicle_models + 25 modelos seed + trigger auto-create |
| 6 | `sql/06_relations.sql` | Tablas: service_vehicles, part_vehicles, order_parts + RLS |

### Paso 4 — Configurar Supabase Auth

1. **Dashboard → Settings → Authentication → URL Configuration**
   - **Site URL:** `https://TU_DOMINIO.com` (el dominio final del cliente)
   - **Redirect URLs:** `https://TU_DOMINIO.com/**`
2. **Dashboard → Settings → API** → **Copiar y guardar estos 3 valores:**
   - **Project URL** (ej: `https://abcdefghijklm.supabase.co`)
   - **anon public key** (empieza con `eyJ...`)
   - **service_role key** (empieza con `eyJ...`) ← **SECRETA, no la compartas**

### Paso 5 — Desplegar las 3 Edge Functions

Para cada una (`chat-ai`, `whatsapp-webhook`, `daily-reminders`):

1. **Dashboard → Edge Functions → Create a new function**
2. **Nombre:** (ej: `whatsapp-webhook`)
3. Pegar el código desde `edge-functions/<nombre>/index.ts`
4. Click **Deploy**
5. En **Secrets** (pestaña dentro de la función), agregar:

```
DEEPSEEK_API_KEY = sk-XXXXXXXXXXXXXXXX
SUPABASE_URL = https://abcdefghijklm.supabase.co
SUPABASE_SERVICE_ROLE_KEY = eyJ... (la service_role del paso 4)
```

### Paso 6 — Actualizar credenciales en el código

Editar estos archivos en el fork ANTES de pushear:

**`js/supabase.js`:**
```javascript
const SUPABASE_URL = 'https://abcdefghijklm.supabase.co';   // ← Project URL del cliente
const SUPABASE_ANON_KEY = 'eyJ...';                          // ← anon key del cliente
```

**`js/config.js`:**
```javascript
const TALLER_CONFIG = {
  name: ['Aquiles', 'Suspensión'],           // ← nombre del taller
  owner: {
    name: 'Juan Pérez',                       // ← nombre del dueño
    phone: '54911XXXXXXXX',                   // ← WhatsApp del taller
  },
  screensaverMinutes: 5,
};
```

**`n8n/whatsapp-bot.json`** — reemplazar TODAS las ocurrencias de `glrveolwztjirwatdmyf` por el nuevo project ref (ej: `abcdefghijklm`) y el Bearer token por la nueva anon key.

**`n8n/daily-reminders.json`** y **`n8n/appointment-confirmation.json`** — reemplazar TODAS las ocurrencias de:
- `glrveolwztjirwatdmyf` → nuevo project ref
- `TU_SERVICE_ROLE_KEY_DE_SUPABASE` → nueva service_role key
- `Bearer eyJ...` viejo → `Bearer <nueva_anon_key>` donde corresponda

### Paso 7 — Cloudflare Pages + Dominio

#### 7.1 Conectar repo a Cloudflare Pages

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Pages → Create a project**
2. **Connect to Git** → elegí el fork de GitHub
3. Configuración de build:
   - **Framework preset:** None
   - **Build command:** _(dejar vacío)_
   - **Build output directory:** _(dejar vacío, es HTML plano en el root)_
4. Click **Save and Deploy**

#### 7.2 Configurar dominio personalizado

1. En el proyecto de Pages → **Custom domains → Set up a custom domain**
2. Ingresar el dominio: `taller.tunombre.com`
3. Cloudflare te da los registros DNS que tenés que agregar

#### 7.3 DNS (si el dominio está en otro registrador)

Si el cliente compró el dominio en **GoDaddy, Namecheap, DonWeb, etc.**:

1. En el registrador, cambiar los **nameservers** a los de Cloudflare:
   ```
   ns1.cloudflare.com
   ns2.cloudflare.com
   ```
2. Esperar 24-48h a que propaguen los DNS
3. Una vez propagado, Cloudflare gestiona el SSL automáticamente

Si el cliente ya tiene el dominio en Cloudflare, simplemente agregar un CNAME:
| Tipo | Nombre | Valor |
|---|---|---|
| CNAME | `taller` | `tu-proyecto.pages.dev` |

### Paso 8 — VPS para Evolution API + n8n (24/7)

> **¿Por qué un VPS?** La PC del cliente se apaga de noche. Si n8n y Evolution API no están corriendo 24/7, no hay WhatsApp bot ni recordatorios ni confirmaciones automáticas.

#### 8.1 Contratar VPS

| Proveedor | Plan más barato | Precio |
|---|---|---|
| **Hetzner** (recomendado) | CX22 (2 vCPU, 4GB RAM, 40GB SSD) | **~$6/mes** |
| DigitalOcean | Basic Droplet (2GB RAM) | $12/mes |
| Vultr | Regular (2GB RAM) | $12/mes |

> **Hetzner CX22 es suficiente** para correr Docker (Evolution API + PostgreSQL + n8n) para 3-5 clientes.

1. Crear cuenta en [hetzner.com/cloud](https://hetzner.com/cloud)
2. **Create Server** → ubicación: Ashburn (USA, menor latencia desde Argentina)
3. **OS:** Ubuntu 24.04
4. **Plan:** CX22 ($6/mes)
5. Agregar **SSH key** (tu clave pública)
6. **Create**

#### 8.2 Conectarse al VPS

```powershell
ssh root@<IP_DEL_VPS>
```

#### 8.3 Instalar Docker en el VPS

```bash
# Copiar y pegar en el VPS:
apt update && apt install -y docker.io docker-compose
systemctl enable docker --now
docker --version
```

#### 8.4 Instalar Node.js en el VPS

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node --version
```

#### 8.5 Levantar Evolution API en el VPS

```bash
# Red
docker network create evolution-net

# PostgreSQL
docker run -d --name evolution-postgres --network evolution-net \
  -e POSTGRES_DB=evolution_api \
  -e POSTGRES_USER=evolution \
  -e POSTGRES_PASSWORD=evolution123 \
  --restart unless-stopped \
  postgres:15

sleep 8

# Evolution API
docker run -d --name evolution-api --network evolution-net -p 8080:8080 \
  -e AUTHENTICATION_TYPE=apikey \
  -e AUTHENTICATION_API_KEY=123456 \
  -e DATABASE_PROVIDER=postgresql \
  -e DATABASE_CONNECTION_URI="postgresql://evolution:evolution123@evolution-postgres:5432/evolution_api" \
  -e CACHE_REDIS_ENABLED=false \
  -e CACHE_LOCAL_ENABLED=true \
  -e SERVER_URL=http://<IP_DEL_VPS>:8080 \
  -e LANGUAGE=es \
  --restart unless-stopped \
  evoapicloud/evolution-api:v2.3.7
```

> **`--restart unless-stopped`** hace que Docker reinicie los containers automáticamente si el VPS se reinicia.

#### 8.6 Crear instancia WhatsApp y generar QR

```bash
# Crear instancia
curl -X POST http://localhost:8080/instance/create \
  -H "apikey: 123456" -H "Content-Type: application/json" \
  -d '{"instanceName":"taller","integration":"WHATSAPP-BAILEYS","token":"taller-token"}'

# Obtener QR (guardar como PNG para enviar al cliente)
curl -s http://localhost:8080/instance/connect/taller -H "apikey: 123456" | \
  python3 -c "import sys,json,base64; d=json.load(sys.stdin); open('qr.png','wb').write(base64.b64decode(d['base64'].split(',')[1]))"
```

> **El QR se lo enviás al cliente** por WhatsApp o email. Él lo escanea con su celular. A partir de ahí, el bot atiende en SU número de WhatsApp.

#### 8.7 Configurar webhook

```bash
curl -X POST http://localhost:8080/webhook/set/taller \
  -H "apikey: 123456" -H "Content-Type: application/json" \
  -d '{"webhook":{"enabled":true,"url":"http://localhost:5678/webhook/whatsapp-webhook","events":["MESSAGES_UPSERT"]}}'
```

#### 8.8 Levantar n8n en el VPS (24/7)

```bash
# Instalar pm2 para mantener n8n corriendo siempre
npm install -g pm2

# Iniciar n8n como servicio permanente
pm2 start n8n -- start
pm2 save
pm2 startup
```

n8n queda accesible en `http://<IP_DEL_VPS>:5678`.

#### 8.9 Importar workflows en n8n

1. Abrí `http://<IP_DEL_VPS>:5678` → creá cuenta de admin
2. Importá los 3 JSON de `n8n/` (ya actualizados con las credenciales del cliente en el paso 6)
3. Activá los 3 workflows

### Paso 9 — Seguridad del VPS

```bash
# Firewall: solo abrir los puertos necesarios
apt install -y ufw
ufw allow 22/tcp      # SSH
ufw allow 8080/tcp    # Evolution API (solo local, no exponer a internet)
ufw allow 5678/tcp    # n8n (solo local o con IP fija tuya)
ufw enable

# Si necesitás acceso remoto a los dashboards, usá un túnel SSH:
# ssh -L 8080:localhost:8080 -L 5678:localhost:5678 root@<IP_DEL_VPS>
```

> **No expongas el puerto 8080 ni el 5678 a internet directamente.** Usá el túnel SSH para acceder desde tu PC. Evolution API se comunica con n8n vía `localhost` dentro del VPS.

### Paso 10 — Probar todo

| # | Prueba | URL / Método | Esperado |
|---|---|---|---|
| 1 | Frontend carga | `https://TU_DOMINIO.com/login.html` | Login visible, partículas, formulario a la derecha |
| 2 | Registro admin | Formulario de registro | Crea cuenta, va al dashboard |
| 3 | El admin ve todo | `isAdmin()` en el código | Sidebar muestra Servicios, Repuestos, Modelos |
| 4 | WhatsApp bot | Mandar WhatsApp al número del cliente | El bot responde en <10 segundos |
| 5 | Cita por WhatsApp | "Quiero agendar cambio de amortiguadores" | El bot pide datos, crea cita, se ve en dashboard |
| 6 | Recordatorios | Probar Edge Function desde n8n | Busca citas de mañana, genera notificaciones |
| 7 | Confirmación | Cambiar estado de cita a "confirmed" | Trigger genera notificación, n8n la envía |
| 8 | Screensaver | Dejar la app abierta 5 min sin tocar nada | Aparece efecto partículas con nombre del taller |

---

## 2. Check list — Valores a reemplazar por cliente

| Archivo / Lugar | Campo | Reemplazar por |
|---|---|---|
| `js/supabase.js` | `SUPABASE_URL` | URL del nuevo proyecto Supabase |
| `js/supabase.js` | `SUPABASE_ANON_KEY` | Anon key del nuevo proyecto |
| `js/config.js` | `TALLER_CONFIG.name` | `['Nombre', 'Taller']` |
| `js/config.js` | `TALLER_CONFIG.owner.name` | Nombre del dueño |
| `js/config.js` | `TALLER_CONFIG.owner.phone` | WhatsApp del taller |
| Edge Functions (x3) | Secrets: `SUPABASE_URL` | URL del nuevo proyecto |
| Edge Functions (x3) | Secrets: `SUPABASE_SERVICE_ROLE_KEY` | Service role key del nuevo proyecto |
| Edge Functions (x3) | Secrets: `DEEPSEEK_API_KEY` | La misma (o una nueva si querés separar costos) |
| `n8n/*.json` (x3) | `glrveolwztjirwatdmyf` → nuevo project ref | En TODAS las URLs de Supabase |
| `n8n/*.json` (x3) | `Bearer eyJ...` viejo → nuevo | Authorization headers |
| `n8n/appointment-confirmation.json` | `apikey` | Service role key del cliente |
| Cloudflare Pages | Custom domain | `taller.nombredelcliente.com` |
| VPS | `SERVER_URL` | `http://<IP_DEL_VPS>:8080` |
| VPS | WhatsApp QR | El dueño del taller lo escanea |

---

## 3. Script de deploy automatizado para el VPS

Copiá y pegá este bloque entero en la terminal del VPS (Ubuntu) para levantar TODO de una vez:

```bash
#!/bin/bash
# === DEPLOY AUTOMATICO TALLER PRO - VPS CLIENTE ===
# Ejecutar como root en Ubuntu 24.04

set -e

echo "1/6 Instalando dependencias..."
apt update && apt install -y docker.io nodejs npm
npm install -g pm2
systemctl enable docker --now

echo "2/6 Docker network + PostgreSQL..."
docker network create evolution-net 2>/dev/null || true
docker rm -f evolution-postgres evolution-api 2>/dev/null || true
docker run -d --name evolution-postgres --network evolution-net \
  -e POSTGRES_DB=evolution_api -e POSTGRES_USER=evolution -e POSTGRES_PASSWORD=evolution123 \
  --restart unless-stopped postgres:15
sleep 10

echo "3/6 Evolution API..."
docker run -d --name evolution-api --network evolution-net -p 8080:8080 \
  -e AUTHENTICATION_TYPE=apikey -e AUTHENTICATION_API_KEY=123456 \
  -e DATABASE_PROVIDER=postgresql \
  -e DATABASE_CONNECTION_URI="postgresql://evolution:evolution123@evolution-postgres:5432/evolution_api" \
  -e CACHE_REDIS_ENABLED=false -e CACHE_LOCAL_ENABLED=true \
  -e SERVER_URL=http://$(hostname -I | awk '{print $1}'):8080 \
  -e LANGUAGE=es --restart unless-stopped \
  evoapicloud/evolution-api:v2.3.7
sleep 10

echo "4/6 Creando instancia WhatsApp..."
curl -s -X POST http://localhost:8080/instance/create \
  -H "apikey: 123456" -H "Content-Type: application/json" \
  -d '{"instanceName":"taller","integration":"WHATSAPP-BAILEYS","token":"taller-token"}'
sleep 2

echo "5/6 Generando QR (se guarda como /root/qr.png)..."
curl -s http://localhost:8080/instance/connect/taller -H "apikey: 123456" | \
  python3 -c "import sys,json,base64; d=json.load(sys.stdin); open('/root/qr.png','wb').write(base64.b64decode(d['base64'].split(',')[1])); print('QR guardado: /root/qr.png')"

echo "6/6 Configurando webhook + n8n..."
curl -s -X POST http://localhost:8080/webhook/set/taller \
  -H "apikey: 123456" -H "Content-Type: application/json" \
  -d '{"webhook":{"enabled":true,"url":"http://localhost:5678/webhook/whatsapp-webhook","events":["MESSAGES_UPSERT"]}}'

pm2 start n8n -- start
pm2 save && pm2 startup

echo ""
echo "=========================================="
echo "  DEPLOY COMPLETO"
echo "=========================================="
echo ""
echo "Enviá el QR al cliente: /root/qr.png"
echo "n8n: http://$(hostname -I | awk '{print $1}'):5678"
echo ""
echo "IMPORTAR workflows en n8n manualmente, luego activarlos."
```

---

## 4. Informe de servicios comprometidos

### Costos, riesgos y limitaciones de cada servicio

| Servicio | Versión | Límite free | ¿Necesita pago? | Costo pago | ¿Riesgo? |
|---|---|---|---|---|---|
| **Cloudflare Pages** | Free | 500 builds/mes, 100MB/sitio | No | Pro: $20/mes | **Bajo** — free sobra |
| **Supabase** | Free (2 proyectos) | 500MB DB, 2GB BW, 50K usuarios | Sí, al crecer | **Pro: $25/mes** | **Medio** — 500MB se llena con volumen alto. Pro por $25 es suficiente |
| **GitHub** | Free | Ilimitado repos privados | No | Teams: $4/usuario/mes | **No** |
| **Evolution API** | Open source | Sin límites | No | $0 | **ALTO** — Viola ToS de WhatsApp. Riesgo de baneo del número. Alternativa: Meta WhatsApp Cloud API |
| **n8n (self-hosted)** | Free | Sin límites | Opcional | $0 / n8n.cloud $20/mes | **Bajo** — corriendo en VPS con pm2 es estable |
| **DeepSeek API** | Pago por uso | N/A | Sí | ~$0.0005/conv | **Bajo** — muy barato |
| **VPS Hetzner** | Pago | N/A | Sí | **$6/mes (CX22)** | **No** — servicio profesional |
| **Dominio** | Pago | N/A | Sí | ~$10-15/año | **No** |

### Costo mensual por escenario

| Escenario | Clientes | Servicios | Costo/mes total | Costo/cliente |
|---|---|---|---|---|
| **Mínimo** | 1 | CF Free + Supabase Free + VPS $6 + DeepSeek ~$3 | **~$10** | $10 |
| **Recomendado** | 3 | CF Free x3 + Supabase Pro $25 + VPS $10 + DeepSeek ~$10 | **~$45** | $15 |
| **Profesional** | 10 | Ídem + VPS $20 + DeepSeek ~$30 | **~$95** | $9.50 |
| **Con Meta oficial** | 3 | Ídem recomendado + Meta API ~$20-40 | **~$85** | $28 |

### ¿Sirve cada servicio para más de un cliente?

| Servicio | ¿Compartible? | Cómo |
|---|---|---|
| Cloudflare Pages | No (1 proyecto por dominio) | Cada cliente tiene su proyecto (gratis) |
| Supabase Pro ($25) | **Sí** | Una DB con tenant_id. 10-15 clientes en un solo Pro |
| GitHub | **Sí** | Repo multi-tenant o monorepo |
| Evolution API | **Sí** (con matices) | Una instancia por número de WhatsApp. Mismo VPS corre varias |
| n8n | **Sí** | Una instancia maneja workflows de varios clientes |
| DeepSeek | **Sí** | Misma API key. Se factura por uso total |
| VPS | **Sí** | Mismo VPS corre todo para varios clientes |

---

## 5. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| WhatsApp banea el número (Evolution API) | **Media** | **Crítico** | Migrar a Meta WhatsApp Cloud API (oficial) cuando sea viable |
| VPS se cae | **Baja** | **Alto** | Elegir proveedor serio (Hetzner, DO). Monitorear uptime |
| Supabase Free se llena | **Media** | **Medio** | Monitorear uso. Migrar a Pro antes del límite |
| DeepSeek deja de funcionar | **Baja** | **Alto** | Tener crédito cargado. Alternativa: OpenAI |
| n8n se rompe con update | **Baja** | **Medio** | No actualizar sin probar. Backup de workflows JSON |
| El cliente cambia de celular | **Media** | **Bajo** | Regenerar QR en el VPS, escanear de nuevo. 2 minutos |

---

*Documento creado como parte de Taller Pro. Actualizado a mayo 2026.*
