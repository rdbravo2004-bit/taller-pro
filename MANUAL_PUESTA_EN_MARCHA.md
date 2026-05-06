# Manual de Puesta en Marcha — Taller Pro

> **Tu máquina local.** Cómo levantar el sistema completo para desarrollo y pruebas, acceder a producción, y reconstruir todo desde cero si la PC muere.

---

## 1. Requisitos previos

| Herramienta | Link | Para qué |
|---|---|---|
| Docker Desktop | [docker.com](https://docker.com/products/docker-desktop) | Evolution API + PostgreSQL |
| Node.js (incluye npx) | [nodejs.org](https://nodejs.org) | n8n + serve frontend |
| Git | [git-scm.com](https://git-scm.com) | Clonar el repo |
| Navegador (Edge/Chrome) | — | Frontend, Supabase Dashboard, n8n |
| Cuenta de GitHub | [github.com](https://github.com) | Código fuente |
| Cuenta de Supabase | [supabase.com](https://supabase.com) | Base de datos y Edge Functions |
| Cuenta de DeepSeek | [platform.deepseek.com](https://platform.deepseek.com) | API key para la IA |

**Verificar instalación:**
```powershell
docker --version
node --version
git --version
```

---

## 2. Primer setup (solo la primera vez)

> **Seguí estos pasos en orden exacto.** Cada bloque se copia y pega en PowerShell.

### Paso 1 — Clonar el repositorio

```powershell
git clone https://github.com/rdbravo2004-bit/taller-pro.git
Set-Location D:\talleres_v0
```

### Paso 2 — Ejecutar SQL en Supabase

1. Abrí [supabase.com/dashboard](https://supabase.com/dashboard) → tu proyecto `glrveolwztjirwatdmyf`
2. Andá a **SQL Editor**
3. Ejecutá estos archivos **en orden** (arrastrá o copiá y pegá):
   - `sql/01_schema.sql` → tablas principales
   - `sql/02_seed.sql` → servicios (13 de tren delantero)
   - `sql/03_triggers.sql` → notificaciones + message_log
   - `sql/04_repuestos.sql` → tabla parts + part_number
   - `sql/05_vehicle_models.sql` → 25 modelos seed + trigger auto-create
   - `sql/06_relations.sql` → service_vehicles + part_vehicles + order_parts

### Paso 3 — Configurar Edge Functions

1. **Dashboard → Edge Functions**
2. Para cada función, creá o editá y pegá el archivo correspondiente:

| Función | Archivo |
|---|---|
| `chat-ai` | `edge-functions/chat-ai/index.ts` |
| `whatsapp-webhook` | `edge-functions/whatsapp-webhook/index.ts` |
| `daily-reminders` | `edge-functions/daily-reminders/index.ts` |

3. En cada función, **Settings → Secrets**, agregá estos 3:

```
DEEPSEEK_API_KEY = sk-XXXXXXXXXXXXXXXX
SUPABASE_URL = https://glrveolwztjirwatdmyf.supabase.co
SUPABASE_SERVICE_ROLE_KEY = eyJ... (service_role key de Settings → API)
```

### Paso 4 — Docker: red, PostgreSQL y Evolution API

```powershell
# A. Crear red compartida
docker network create evolution-net

# B. PostgreSQL (base de Evolution API)
docker run -d --name evolution-postgres --network evolution-net `
  -e POSTGRES_DB=evolution_api `
  -e POSTGRES_USER=evolution `
  -e POSTGRES_PASSWORD=evolution123 `
  postgres:15

# C. Esperar a que PostgreSQL esté listo
Start-Sleep -Seconds 8

# D. Evolution API v2.3.7
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

# E. Verificar
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

# D. Verificar (debe decir "open")
Invoke-RestMethod -Uri "http://localhost:8080/instance/connectionState/taller" `
  -Method Get -Headers @{ apikey = "123456" }
```

> **Si WhatsApp rebota:** Asegurate de **cerrar WhatsApp Web** en otros lados. Evolution API usa multi-dispositivo. El QR no compite por el slot web.

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

> Dejala abierta. n8n queda corriendo en `http://localhost:5678`.

### Paso 8 — Importar workflows en n8n

1. Abrí `http://localhost:5678` → iniciá sesión / creá cuenta
2. Importá los 3 workflows (arrastrá los `.json` a la interfaz):

| Archivo | Workflow |
|---|---|
| `n8n/whatsapp-bot.json` | Taller Pro — WhatsApp Bot |
| `n8n/daily-reminders.json` | Taller Pro — Recordatorios Diarios |
| `n8n/appointment-confirmation.json` | Taller Pro — Confirmación de Citas |

3. **Activá el toggle "Active"** en cada uno

### Paso 9 — Levantar el frontend

**Abrí OTRA ventana de PowerShell** y ejecutá:

```powershell
npx serve D:\talleres_v0 -p 3000
```

Abrí `http://localhost:3000/login.html`.

### Verificación final

| Componente | Comando / URL | Esperado |
|---|---|---|
| Docker | `docker ps` | `evolution-api` y `evolution-postgres` Up |
| WhatsApp | `http://localhost:8080/instance/connectionState/taller` + `apikey: 123456` | `"state":"open"` |
| n8n | `http://localhost:5678` | Interfaz carga |
| n8n workflows | En n8n | Los 3 con toggle Active ON |
| Frontend | `http://localhost:3000/login.html` | Login visible, partículas de fondo |
| Bot | Mandar WhatsApp al número vinculado | El bot responde solo |

---

## 3. Acceso a producción vs desarrollo

### Dos entornos, una misma DB

| | Desarrollo (local) | Producción |
|---|---|---|
| **URL** | `http://localhost:3000` | `https://rdbmam.net` |
| **Código** | `D:\talleres_v0` | Cloudflare Pages (deploy automático) |
| **Base de datos** | **LA MISMA** — Supabase `glrveolwztjirwatdmyf` | **LA MISMA** |
| **WhatsApp** | **EL MISMO** — instancia `taller` | **EL MISMO** |
| **n8n** | **EL MISMO** — `localhost:5678` | **EL MISMO** |

> **IMPORTANTE:** Desarrollo y producción comparten la MISMA base de datos de Supabase y el MISMO WhatsApp. Los datos que ves en `localhost:3000` son los mismos que en `rdbmam.net`. Esto es intencional para esta etapa: simplifica todo mientras hay pocos usuarios.

### ¿Cuándo usar cada uno?

| Situación | Usar |
|---|---|
| Probar cambios de código | `localhost:3000` (sin pushear) |
| Mostrar al cliente | `https://rdbmam.net` (siempre actualizado) |
| Testear WhatsApp bot | `localhost:3000` (n8n local procesa los mensajes) |
| El cliente crea citas | `https://rdbmam.net` |

---

## 4. Arranque diario (la PC ya tiene todo instalado)

```powershell
# 1. Abrí Docker Desktop (esperá que el motor esté corriendo)

# 2. Iniciar containers
docker start evolution-postgres
Start-Sleep -Seconds 3
docker start evolution-api

# 3. Verificar WhatsApp
Invoke-RestMethod -Uri "http://localhost:8080/instance/connectionState/taller" `
  -Method Get -Headers @{ apikey = "123456" }
# Si dice "open" → OK. Si dice "close" → regenerar QR (Paso 5)

# 4. Levantar n8n (NUEVA ventana PowerShell)
cmd /c n8n start

# 5. Levantar frontend (NUEVA ventana PowerShell)
npx serve D:\talleres_v0 -p 3000
```

**Ventanas abiertas para que funcione todo:**

| # | Qué corre | URL |
|---|---|---|
| 1 | Docker Desktop (bandeja) | — |
| 2 | PowerShell → n8n | `http://localhost:5678` |
| 3 | PowerShell → Frontend | `http://localhost:3000` |

---

## 5. Backup y recuperación ante desastre

### ¿Qué está respaldado automáticamente?

| Componente | Dónde está respaldado | ¿Vulnerable? |
|---|---|---|
| **Código fuente** | GitHub (`rdbravo2004-bit/taller-pro`) | **No** — clonás de nuevo |
| **Base de datos** | Supabase Cloud | **No** — está en la nube |
| **Edge Functions** | Supabase Cloud + GitHub | **No** — código en el repo, ejecución en Supabase |
| **n8n workflows** | GitHub (`n8n/*.json`) + `.n8n/database.sqlite` | **Sí (el sqlite local)** |
| **Docker images** | Docker Hub (se bajan de nuevo) | **No** |
| **WhatsApp sesión** | Docker volume de Evolution API | **SÍ — vulnerable** |
| **DeepSeek API key** | En tu cabeza / panel de DeepSeek | **Sí (memorizala o guardala)** |
| **Credenciales Supabase** | Dashboard de Supabase (nube) | **No** |

### Lo que SÍ tenés que respaldar manualmente

```powershell
# 1. Copiar la carpeta de n8n (contiene workflows + config + usuarios)
Copy-Item -Recurse "$env:USERPROFILE\.n8n" "D:\backup\n8n-backup-$(Get-Date -Format yyyyMMdd)" -Force

# 2. Guardar estas credenciales en un lugar seguro (Bitwarden, KeePass, o papel)
#    - Supabase URL: https://glrveolwztjirwatdmyf.supabase.co
#    - Supabase anon key: eyJhbGci... (js/supabase.js)
#    - Supabase service_role key: eyJhbGci... (Dashboard → Settings → API)
#    - DeepSeek API key: sk-...
#    - GitHub repo: https://github.com/rdbravo2004-bit/taller-pro
#    - WhatsApp número vinculado: 5491168592944
```

**Frecuencia recomendada:** Respaldar `.n8n` cada 2 semanas o antes de cualquier cambio grande.

### Escenario: se rompió el disco / cambié de PC

```
Tiempo estimado de recuperación total: 20 minutos
```

| Paso | Qué hacer | Tiempo |
|---|---|---|
| 1 | Instalar Docker, Node, Git en la PC nueva | 5 min |
| 2 | `git clone https://github.com/rdbravo2004-bit/taller-pro.git` | 1 min |
| 3 | Copiar backup de `.n8n` a `C:\Users\TU_USUARIO\.n8n` | 1 min |
| 4 | Ejecutar Paso 4 (Docker) y Paso 5 (WhatsApp QR) | 5 min |
| 5 | Ejecutar Paso 6 (webhook) y Paso 7 (n8n) | 2 min |
| 6 | Ejecutar Paso 9 (frontend) | 1 min |
| 7 | Escanear QR con WhatsApp | 1 min |
| 8 | Verificar todo | 2 min |

**No necesitás:** volver a crear Supabase, volver a ejecutar SQLs, volver a deployar Edge Functions, volver a configurar n8n workflows (si restauraste `.n8n`).

### Escenario: perdiste TODO (sin backup de .n8n)

```
Tiempo estimado: 30 minutos (hay que reimportar workflows a mano)
```

Es lo mismo que arriba pero en el paso 3 no restaurás `.n8n`. En su lugar:
- Creás cuenta nueva en n8n (`http://localhost:5678`)
- Importás manualmente los 3 JSON de `n8n/`
- Activás los workflows

---

## 6. Reconstrucción total desde cero (script completo)

Si querés reconstruir TODO desde cero en una PC nueva, copiá y pegá este bloque ENTERO en PowerShell como administrador:

```powershell
# === RECONSTRUCCIÓN TOTAL TALLER PRO ===
# Ejecutar en PowerShell como administrador

# 1. Clonar repo
Set-Location D:\
git clone https://github.com/rdbravo2004-bit/taller-pro.git talleres_v0
Set-Location D:\talleres_v0

# 2. Docker
docker network create evolution-net 2>$null
docker rm -f evolution-postgres evolution-api 2>$null
docker run -d --name evolution-postgres --network evolution-net `
  -e POSTGRES_DB=evolution_api -e POSTGRES_USER=evolution -e POSTGRES_PASSWORD=evolution123 `
  postgres:15
Start-Sleep -Seconds 8
docker run -d --name evolution-api --network evolution-net -p 8080:8080 `
  -e AUTHENTICATION_TYPE=apikey -e AUTHENTICATION_API_KEY=123456 `
  -e DATABASE_PROVIDER=postgresql `
  -e DATABASE_CONNECTION_URI="postgresql://evolution:evolution123@evolution-postgres:5432/evolution_api" `
  -e CACHE_REDIS_ENABLED=false -e CACHE_LOCAL_ENABLED=true `
  -e SERVER_URL=http://localhost:8080 -e LANGUAGE=es `
  evoapicloud/evolution-api:v2.3.7
Start-Sleep -Seconds 10

# 3. WhatsApp
Invoke-RestMethod -Uri "http://localhost:8080/instance/create" `
  -Method Post -ContentType "application/json" -Headers @{ apikey = "123456" } `
  -Body '{"instanceName":"taller","integration":"WHATSAPP-BAILEYS","token":"taller-token"}'
$r = Invoke-RestMethod -Uri "http://localhost:8080/instance/connect/taller" `
  -Method Get -Headers @{ apikey = "123456" }
$d = $r.base64 -replace 'data:image/png;base64,', ''
[System.IO.File]::WriteAllBytes("D:\talleres_v0\whatsapp_qr.png", [System.Convert]::FromBase64String($d))
Start-Process "D:\talleres_v0\whatsapp_qr.png"
Write-Host ">>> ESCANEÁ EL QR CON WHATSAPP AHORA <<<"

# 4. Webhook
Invoke-RestMethod -Uri "http://localhost:8080/webhook/set/taller" `
  -Method Post -ContentType "application/json" -Headers @{ apikey = "123456" } `
  -Body '{"webhook":{"enabled":true,"url":"http://host.docker.internal:5678/webhook/whatsapp-webhook","events":["MESSAGES_UPSERT"]}}'

# 5. Restaurar backup de n8n (si existe)
$backupDir = "D:\backup\n8n-backup-*"
$latest = Get-ChildItem $backupDir -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($latest) {
  Copy-Item -Recurse "$($latest.FullName)\*" "$env:USERPROFILE\.n8n\" -Force
  Write-Host "n8n restaurado desde respaldo: $($latest.Name)"
} else {
  Write-Host "No se encontró respaldo de n8n. Importá los workflows manualmente."
}

Write-Host "`n=== RECONSTRUCCIÓN COMPLETA ==="
Write-Host "1. Escaneá el QR con WhatsApp"
Write-Host "2. Abrí otra PowerShell: cmd /c n8n start"
Write-Host "3. Abrí otra PowerShell: npx serve D:\talleres_v0 -p 3000"
Write-Host "4. Si no había backup de n8n: importá los 3 JSON de n8n/ y activalos"
```

---

## 7. Troubleshooting

| Problema | Causa probable | Solución |
|---|---|---|
| WhatsApp no responde | Instancia desconectada | `docker logs evolution-api --tail 20`. Si no dice "open", regenerar QR |
| WhatsApp rebota el QR | WhatsApp Web abierto en otro lado | Cerrar WhatsApp Web. Evolution API es multi-dispositivo, pero a veces interfiere |
| n8n no levanta | Proceso previo colgado | Cerrar ventana cmd y volver a ejecutar `cmd /c n8n start` |
| QR expiró | El QR dura ~30 segundos | Repetir paso B de vinculación |
| `localhost:3000` no carga | `npx serve` no está corriendo | Reejecutar `npx serve D:\talleres_v0 -p 3000` |
| Evolution API error 400 | Instancia no creada o perdida | `curl GET /instance/fetchInstances`, si está vacía, recrear |
| Docker no inicia | Docker Desktop no está corriendo | Abrir Docker Desktop desde el menú Inicio |
| Puerto 8080 ocupado | Otro proceso usa ese puerto | `netstat -ano | findstr :8080` |
| `fetch is not defined` en n8n | Sandbox de n8n no expone fetch() | Usar `this.helpers.httpRequest()` |
| `Module 'https' is disallowed` | Sandbox bloquea require() | Usar `this.helpers.httpRequest()` |
| Templates `={{ }}` no se evalúan | `jsonBody` no procesa templates | Preparar JSON en Code node con `JSON.stringify()` |
| n8n "Error in workflow" (dato vacío) | Webhook envelope | Los datos reales están en `$input.first().json.body.data`, no en `.data` |

---

## 8. Cuentas y credenciales de referencia

| Servicio | URL | Usuario/Email |
|---|---|---|
| **GitHub (repo)** | `https://github.com/rdbravo2004-bit/taller-pro` | rdbravo2004 |
| **Supabase** | `https://supabase.com/dashboard` | tu email |
| **Supabase Project** | `https://glrveolwztjirwatdmyf.supabase.co` | — |
| **DeepSeek** | `https://platform.deepseek.com` | tu email |
| **Cloudflare Pages** | `https://dash.cloudflare.com` | tu email |
| **n8n (local)** | `http://localhost:5678` | rdbravo2004@gmail.com |
| **Evolution API** | `http://localhost:8080` | apikey: `123456` |
| **Producción** | `https://rdbmam.net` | — (login con Supabase Auth) |
| **WhatsApp vinculado** | — | `5491168592944` |
