# Manual de Puesta en Marcha — Taller Pro (Modo Local)

> **Objetivo:** Dejar corriendo el sistema completo en tu PC para pruebas.
> **Tiempo estimado:** 15 min (primer setup) / 2 min (arranque diario).

---

## 1. Requisitos previos

| Herramienta | Link |
|---|---|
| Docker Desktop | [docker.com/products/docker-desktop](https://docker.com/products/docker-desktop) |
| Node.js (incluye npx) | [nodejs.org](https://nodejs.org) |
| Git | [git-scm.com](https://git-scm.com) |
| Navegador (Edge/Chrome) | — |

**Verificar instalación:**
```powershell
docker --version
node --version
git --version
```

---

## 2. Primer setup (solo la primera vez)

> **Orden de ejecución:** Seguí los pasos en este orden exacto. Cada bloque se copia y pega en **una misma ventana de PowerShell**.

### Paso 1 — Clonar el repositorio

```powershell
git clone https://github.com/rdbravo2004-bit/taller-pro.git
Set-Location D:\talleres_v0
```

### Paso 2 — Ejecutar SQL en Supabase

1. Entrá a [supabase.com/dashboard](https://supabase.com/dashboard) → tu proyecto
2. Andá a **SQL Editor**
3. Ejecutá los siguientes archivos **en orden**, copiando y pegando su contenido:
   - `sql/01_schema.sql`
   - `sql/02_seed.sql`
   - `sql/03_triggers.sql`
   - `sql/04_repuestos.sql`
   - `sql/05_vehicle_models.sql`
   - `sql/06_relations.sql`

### Paso 3 — Configurar Edge Functions en Supabase

1. **Dashboard → Edge Functions**
2. Para cada una de estas funciones, creá o editá la función y pegá el contenido del archivo:
   - `chat-ai` ← `edge-functions/chat-ai/index.ts`
   - `whatsapp-webhook` ← `edge-functions/whatsapp-webhook/index.ts`
   - `daily-reminders` ← `edge-functions/daily-reminders/index.ts`
3. Configurá los **secrets** en cada función (Settings → Secrets):
   - `DEEPSEEK_API_KEY` = tu API key de DeepSeek
   - `SUPABASE_URL` = `https://glrveolwztjirwatdmyf.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = la service_role key (Settings → API → service_role)

### Paso 4 — Docker: red, PostgreSQL y Evolution API

```powershell
# A. Crear red compartida
docker network create evolution-net

# B. Levantar PostgreSQL (base de datos de Evolution API)
docker run -d --name evolution-postgres --network evolution-net `
  -e POSTGRES_DB=evolution_api `
  -e POSTGRES_USER=evolution `
  -e POSTGRES_PASSWORD=evolution123 `
  postgres:15

# C. Esperar 8 segundos a que PostgreSQL esté listo
Start-Sleep -Seconds 8

# D. Levantar Evolution API v2.3.7
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

# E. Verificar que ambos containers están Up
Start-Sleep -Seconds 10
docker ps
```

### Paso 5 — Vincular WhatsApp (obtener QR)

```powershell
# A. Crear instancia "taller"
Invoke-RestMethod -Uri "http://localhost:8080/instance/create" `
  -Method Post -ContentType "application/json" `
  -Headers @{ apikey = "123456" } `
  -Body '{"instanceName":"taller","integration":"WHATSAPP-BAILEYS","token":"taller-token"}'

# B. Obtener QR y guardarlo como PNG
$result = Invoke-RestMethod -Uri "http://localhost:8080/instance/connect/taller" `
  -Method Get -Headers @{ apikey = "123456" }
$base64Data = $result.base64 -replace 'data:image/png;base64,', ''
[System.IO.File]::WriteAllBytes("D:\talleres_v0\whatsapp_qr.png", [System.Convert]::FromBase64String($base64Data))
Start-Process "D:\talleres_v0\whatsapp_qr.png"

# C. Escanear el QR con WhatsApp
#    Celu → WhatsApp → Ajustes (⋮) → Dispositivos vinculados → Vincular dispositivo
#    ¡RÁPIDO! El QR expira en ~30 segundos.

# D. Verificar conexión (debe decir "open")
Invoke-RestMethod -Uri "http://localhost:8080/instance/connectionState/taller" `
  -Method Get -Headers @{ apikey = "123456" }
```

> **Si falló el QR:** Repetí solo el paso B (generar QR de nuevo).

### Paso 6 — Configurar webhook (Evolution API → n8n)

```powershell
Invoke-RestMethod -Uri "http://localhost:8080/webhook/set/taller" `
  -Method Post -ContentType "application/json" `
  -Headers @{ apikey = "123456" } `
  -Body '{"webhook":{"enabled":true,"url":"http://host.docker.internal:5678/webhook/whatsapp-webhook","events":["MESSAGES_UPSERT"]}}'
```

### Paso 7 — Levantar n8n

**Abrí una NUEVA ventana de PowerShell** y ejecutá:

```powershell
cmd /c n8n start
```

Dejala abierta. n8n queda corriendo en `http://localhost:5678`.

### Paso 8 — Importar workflows en n8n

1. Abrí `http://localhost:5678` en el navegador
2. Iniciá sesión o creá tu cuenta
3. Para cada archivo en `D:\talleres_v0\n8n\`:
   - Arrastrá el archivo `.json` a la interfaz de n8n
   - O usá **Import from File** (esquina superior derecha)
4. **Activá el toggle de "Active"** en cada workflow:
   - `Taller Pro — WhatsApp Bot`
   - `Taller Pro — Recordatorios Diarios`
   - `Taller Pro — Confirmación de Citas`

### Paso 9 — Levantar el frontend

**Abrí OTRA ventana de PowerShell** y ejecutá:

```powershell
npx serve D:\talleres_v0 -p 3000
```

Abrí `http://localhost:3000/login.html` en el navegador.

### Verificación final

| Componente | Cómo verificarlo | Estado esperado |
|---|---|---|
| Docker | `docker ps` | `evolution-api` y `evolution-postgres` Up |
| WhatsApp | `curl http://localhost:8080/instance/connectionState/taller -H "apikey: 123456"` | `"state":"open"` |
| n8n | Abrir `http://localhost:5678` | Carga la interfaz |
| n8n workflows | En n8n, ver los 3 workflows | Toggle "Active" encendido |
| Frontend | Abrir `http://localhost:3000/login.html` | Formulario de login |
| Bot WhatsApp | Mandar un WhatsApp al número vinculado | El bot responde solo |

---

## 3. Arranque diario (la PC ya tiene todo instalado)

Seguí estos pasos en orden cada vez que quieras usar el sistema:

```powershell
# 1. Abrí Docker Desktop (esperá que el motor esté corriendo)

# 2. Iniciar containers (PowerShell)
docker start evolution-postgres
Start-Sleep -Seconds 3
docker start evolution-api

# 3. Verificar WhatsApp sigue vinculado
Invoke-RestMethod -Uri "http://localhost:8080/instance/connectionState/taller" `
  -Method Get -Headers @{ apikey = "123456" }
# Si dice "close", generá un nuevo QR (ver Paso 5 del setup inicial)

# 4. Levantar n8n (NUEVA ventana PowerShell)
cmd /c n8n start

# 5. Levantar frontend (NUEVA ventana PowerShell)
npx serve D:\talleres_v0 -p 3000
```

**Resumen de ventanas abiertas:**
| Ventana | Corre |
|---|---|
| Docker Desktop | Motor (bandeja del sistema) |
| PowerShell #1 | n8n (`http://localhost:5678`) |
| PowerShell #2 | Frontend (`http://localhost:3000`) |

---

## 4. Troubleshooting

| Problema | Causa probable | Solución |
|---|---|---|
| WhatsApp no responde | Instancia desconectada | `docker logs evolution-api --tail 20`. Si el estado no es "open", regenerar QR |
| n8n no levanta | Proceso previo colgado | Cerrar ventana cmd y volver a ejecutar `cmd /c n8n start` |
| QR no abre / expiró | El QR dura ~30 segundos | Repetir paso B de vinculación (generar QR de nuevo) |
| `localhost:3000` no carga | `npx serve` no está corriendo | Reejecutar `npx serve D:\talleres_v0 -p 3000` |
| Evolution API error 400 | Instancia no creada o perdida | `curl GET /instance/fetchInstances`, si está vacía, recrear instancia |
| Docker no inicia | Docker Desktop no está corriendo | Abrir Docker Desktop desde el menú Inicio |
| Puerto 8080 ocupado | Otro proceso usa ese puerto | `netstat -ano | findstr :8080` para ver quién lo ocupa |
| "Module https disallowed" en n8n | Código usa require('https') | En n8n Code nodes solo usar `this.helpers.httpRequest()` |
| Templates `={{ }}` no se evalúan | `jsonBody` de n8n no procesa templates | Usar Code node para preparar el JSON con `JSON.stringify()` |
