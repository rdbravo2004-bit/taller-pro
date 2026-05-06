# Manual de Escalabilidad — Taller Pro

> Cómo evolucionar el sistema desde 1 cliente hasta un SaaS multi-cliente. Estrategia, tecnología y costos por fase.

---

## Resumen ejecutivo

| Fase | Clientes | Stack | Costo/mes total | Tiempo de implementación |
|---|---|---|---|---|
| **Fase 1 — Actual** | 1-3 | HTML vanilla + Supabase Free + Evolution + n8n local | ~$3 | Ya está |
| **Fase 2 — Multi-tenant** | 3-15 | HTML vanilla + Supabase Pro + VPS | ~$40 | 1-2 semanas |
| **Fase 3 — SaaS** | 15-100+ | React + TypeScript + Tailwind + shadcn/ui | ~$55-75 | 2-3 meses |

---

## Fase 1 — HTML Vanilla (Actual)

### Estado actual

```
┌────────────────────────────────────────────┐
│  Cliente 1                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Supabase │  │ WhatsApp │  │ Frontend │ │
│  │ (Free)   │  │ (Evo API)│  │ (CF Pages)│ │
│  └──────────┘  └──────────┘  └──────────┘ │
└────────────────────────────────────────────┘
```

- **1 repo = 1 cliente** (fork manual)
- **1 proyecto Supabase = 1 cliente** (DB aislada)
- **1 instancia Evolution API = 1 WhatsApp**
- **n8n** en PC local del cliente o VPS

### Límites

- **Máximo 3 clientes** sin volverse loco con el mantenimiento
- Cada fix o nueva feature hay que aplicarlo **N veces** (una por fork)
- Las DBs están aisladas: no se puede ver todos los clientes desde un solo panel
- El onboarding de un cliente nuevo es **manual y lleva ~2 horas**

### Cuándo migrar a Fase 2

- Tenés **3 o más clientes** pagando
- Empezás a sentir dolor al hacer el mismo fix en múltiples forks
- Querés un panel centralizado para ver todos los talleres

---

## Fase 2 — Multi-tenant (1-2 semanas de desarrollo)

### Arquitectura

```
┌─────────────────────────────────────────────────┐
│  1 solo repositorio GitHub                      │
│  1 solo proyecto Supabase Pro ($25/mes)          │
│                                                  │
│  ┌──────────────┬──────────────┬──────────────┐ │
│  │  tenant_id=1 │  tenant_id=2 │  tenant_id=3 │ │
│  │  Taller A    │  Taller B    │  Taller C    │ │
│  └──────────────┴──────────────┴──────────────┘ │
│                                                  │
│  RLS por tenant_id: cada taller ve solo sus datos│
└─────────────────────────────────────────────────┘
```

### Cambios necesarios

#### 1. Base de datos

Agregar `tenant_id UUID` a TODAS las tablas principales:

```sql
ALTER TABLE public.clients ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.appointments ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.vehicles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.services ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
-- ... etc
```

Crear tabla `tenants`:

```sql
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  owner_name TEXT,
  owner_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### 2. RLS con tenant_id

```sql
-- Ejemplo: un usuario solo ve citas de su tenant
CREATE POLICY "Ver citas de mi tenant"
  ON public.appointments FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );
```

#### 3. Frontend

- Agregar `tenant_id` al perfil del usuario
- Cada query de Supabase agrega `.eq('tenant_id', currentTenantId)`
- El subdominio (`taller-a.rdbmam.net`, `taller-b.rdbmam.net`) determina qué tenant cargar

#### 4. n8n workflows

- Un solo set de 3 workflows que reciben `tenant_id` como parámetro
- La Edge Function recibe `tenant_id` y lo usa para filtrar todas las queries
- Evolution API: una instancia por número de WhatsApp (sigue siendo lo mismo)

### Ventajas

| Aspecto | Antes (Fase 1) | Después (Fase 2) |
|---|---|---|
| Repos | 3 forks separados | 1 solo repo |
| DB | 3 proyectos Supabase | 1 proyecto Pro |
| Fix de un bug | 3 veces (cada fork) | 1 vez → todos actualizados |
| Panel central | No existe | Un SQL query ve todos los talleres |
| Onboarding cliente | ~2 horas | ~15 minutos (script SQL + config) |

### Costo Fase 2

| Servicio | Costo/mes |
|---|---|
| Supabase Pro | $25 |
| VPS Hetzner (n8n + Evolution API 24/7) | $10 |
| Cloudflare Pages | $0 |
| DeepSeek API | ~$10 (3 clientes) |
| **Total** | **~$45** |
| **Por cliente (3)** | **$15** |
| **Por cliente (10)** | **$9** |

---

## Fase 3 — SaaS con React/TypeScript (2-3 meses de desarrollo)

### Stack propuesto

| Capa | Tecnología | ¿Por qué? |
|---|---|---|
| **Frontend** | React 19 + TypeScript | Componentes reutilizables, ecosistema #1, más desarrolladores disponibles |
| **UI** | Tailwind CSS + shadcn/ui | Componentes accesibles, copypaste (no dependencia npm), dark mode, responsive nativo |
| **Routing** | React Router o Next.js App Router | Si es SPA: React Router. Si necesita SSR: Next.js |
| **Estado** | Supabase JS SDK + React Query | Manejo de cache y re-fetch automático |
| **Build** | Vite | Más rápido que webpack, estándar actual de React |
| **Hosting** | Vercel o Cloudflare Pages | Deploy automático desde Git |
| **Backend** | Supabase (se mantiene) | La parte más sólida del stack, no necesita cambio |
| **Automatización** | n8n + Evolution API (se mantiene) | No depende del frontend, sigue igual |
| **IA** | DeepSeek API (se mantiene) | Sigue via Edge Functions |

### ¿Por qué React y no otro framework?

| Framework | Pros | Contras |
|---|---|---|
| **React 19** | Más devs, más librerías, más maduro, shadcn/ui es nativo React | Más boilerplate que Vue o Svelte |
| Vue 3 | Más simple de aprender, buena DX | Menos librerías de UI profesionales, menos devs en el mercado |
| Svelte 5 | Muy rápido, poca configuración | Ecosistema chico, pocos componentes UI enterprise |
| Angular 19 | Opinado, completo | Muy pesado para este tipo de app, mercado argentino casi nulo |

**Recomendación: React + TypeScript.** Es la opción con más tracción en Argentina, más devs disponibles, y shadcn/ui (la mejor librería de componentes del momento) es exclusiva de React.

### ¿SSR o SPA?

```
SPA (Single Page App) → React Router + Vite → Cloudflare Pages
SSR (Server-Side Rendering) → Next.js App Router → Vercel
```

**Recomendación: SPA (Vite + React Router).** Para este tipo de aplicación (dashboard interno, no necesita SEO), SPA alcanza perfecto y es más simple de deployar. Si en el futuro se necesita SEO o landing page pública, se migra a Next.js (Vite → Next.js es un camino conocido).

### Componentes principales

```
src/
├── components/
│   ├── ui/          ← shadcn/ui (button, input, table, dialog, etc)
│   ├── layout/      ← Sidebar, Header, MainLayout
│   ├── calendar/    ← FullCalendar wrapper
│   ├── chat/        ← Chat IA widget
│   └── screensaver/ ← Efecto partículas (port del actual)
├── pages/
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── Appointments.tsx
│   ├── Clients.tsx
│   ├── Services.tsx
│   ├── Parts.tsx
│   └── VehicleModels.tsx
├── hooks/           ← useAuth, useSupabase, useTenant
├── lib/             ← supabase client, config, utils
└── types/           ← TypeScript interfaces (Appointment, Client, etc)
```

### Plan de migración (gradual)

**No se reescribe todo de golpe.** La migración es incremental:

1. **Semana 1-2:** Setup del proyecto Vite + React + TS + Tailwind + shadcn/ui
2. **Semana 3-4:** Login + Dashboard + Sidebar (las pantallas más importantes)
3. **Semana 5-6:** Citas + Clientes (las de más uso)
4. **Semana 7-8:** Servicios + Repuestos + Modelos
5. **Semana 9-10:** Chat IA + Screensaver + Settings
6. **Semana 11-12:** Testing + deploy + migración de clientes existentes

**Durante la migración, el sistema HTML actual sigue funcionando.** Se hace un switch gradual: dashboard.html → Dashboard.tsx, clients.html → Clients.tsx, etc. Los clientes no notan el cambio.

### Ventajas de Fase 3

| Aspecto | Fase 2 (HTML) | Fase 3 (React/TS) |
|---|---|---|
| TypeScript | No (errores en runtime) | Sí (errores en build) |
| Componentes | Código duplicado entre páginas | Reutilizables |
| UI | Funcional pero básica | Profesional (dark mode, skeletons, animaciones) |
| Tests | No | Unit + integration |
| Panel admin multi-cliente | SQL manual | Dashboard con métricas de todos los talleres |
| Onboarding | 15 min (script SQL) | 5 min (formulario en el admin panel) |
| Mobile | No responsive | Responsive (Tailwind) |
| PWA | No | Sí (instalable como app) |

### Costo Fase 3

| Servicio | Costo/mes |
|---|---|
| Supabase Pro | $25 |
| VPS Hetzner (n8n + Evolution API) | $10-20 |
| Vercel Pro o CF Pages | $0-20 |
| DeepSeek API | ~$20-50 (10+ clientes) |
| **Total** | **~$55-95** |
| **Por cliente (15)** | **~$6** |

---

## Comparativa final

| | Fase 1 (Actual) | Fase 2 (Multi-tenant) | Fase 3 (React SaaS) |
|---|---|---|---|
| **Tecnología** | HTML/CSS/JS vanilla | HTML + tenant_id | React + TypeScript + Tailwind + shadcn/ui |
| **Clientes sin dolor** | 1-3 | 3-15 | 15-100+ |
| **Tiempo de desarrollo** | — (ya está) | 1-2 semanas | 2-3 meses |
| **Mantenimiento** | Alto (N forks) | Medio (1 repo) | Bajo (componentes) |
| **TypeScript** | No | No | Sí |
| **UI profesional** | No | No | Sí (dark mode, responsive) |
| **Costo/mes total** | ~$3 | ~$40 | ~$70 |
| **Costo/mes x cliente (10)** | — (no escala) | ~$4 | ~$6 |
| **Onboarding** | 2h manual | 15min script | 5min formulario |
| **Panel multi-cliente** | No | SQL | Dashboard admin |
| **PWA (app instalable)** | No | No | Sí |

---

## Camino recomendado

```
AHORA           →  Fase 1 (HTML vanilla, 1-2 clientes reales)
CUANDO 3+       →  Fase 2 (multi-tenant en Supabase, 1-2 semanas)
CUANDO 10+      →  Fase 3 (React/TS, producto SaaS)
```

**No saltes fases.** Validá con clientes reales antes de invertir en desarrollo. El HTML actual es suficiente para validar el negocio. La plata que pagan los primeros clientes financia la migración a Fase 2. La Fase 3 se hace cuando ya tenés tracción y querés escalar en serio.

### ¿Por qué no arrancar directo en React?

1. **Tiempo:** 2-3 meses sin facturar. Con HTML ya estás cobrando.
2. **Riesgo:** Si el negocio no funciona, perdiste meses de desarrollo.
3. **Iteración:** Es más rápido cambiar HTML que refactorizar componentes React mientras validás con clientes.
4. **El HTML actual ya funciona.** No hay urgencia técnica. Lo que hay que validar es el negocio, no la tecnología.

---

*Documento creado como parte de Taller Pro. Actualizado a mayo 2026.*
