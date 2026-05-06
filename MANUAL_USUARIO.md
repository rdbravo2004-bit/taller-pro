# Manual de Usuario — Taller Pro

> Sistema de gestión de citas y atención al cliente para taller mecánico especializado en tren delantero y suspensión.

---

## 1. Acceso

### Login
1. Abrí `http://localhost:3000/login.html` (desarrollo) o `https://rdbmam.net` (producción)
2. Ingresá tu **email** y **contraseña**
3. Click en **Iniciar sesión**

### Registro
1. En la pantalla de login, click en **"Registrate acá"**
2. Completá nombre completo, email y contraseña
3. El usuario se crea con rol **operario** (el administrador luego puede cambiarlo)

### Recuperación
El sistema usa Supabase Auth. Si olvidás tu contraseña, usá la opción de recuperación en la pantalla de login.

---

## 2. Dashboard

El Dashboard es la pantalla principal después de iniciar sesión.

### Componentes

| Sección | Descripción |
|---|---|
| **Stats** | Tarjetas con totales: citas pendientes, confirmadas, completadas, clientes |
| **Calendario** | FullCalendar con todas las citas. Click en una cita para ver detalles o cambiarla de estado |
| **Citas de hoy** | Tabla con las citas del día actual (hora, cliente, vehículo, servicio, estado) |
| **Asistente IA** | Chat con inteligencia artificial (DeepSeek) que puede consultar disponibilidad y crear citas |

### Chat IA
- Escribí tu consulta en el input y enviá
- O usá los botones rápidos: **Disponibilidad**, **Crear cita**, **Consultar cita**
- El asistente puede buscar turnos disponibles, crear citas nuevas y consultar citas existentes

---

## 3. Citas

**Menú lateral → 📅 Citas**

### Listado
- Tabla con todas las citas ordenadas por fecha
- Columnas: Fecha, Hora, Cliente, Vehículo, Servicio, Estado
- **Filtros superiores:** por fecha, estado (pendiente/confirmada/en curso/completada/cancelada), cliente

### Estados de cita

| Estado | Significado |
|---|---|
| **Pendiente** | Recién creada, esperando confirmación |
| **Confirmada** | El taller confirmó el turno |
| **En curso** | El vehículo está siendo atendido |
| **Completada** | Trabajo terminado |
| **Cancelada** | Cita cancelada |

### Nueva cita
1. Click en **+ Nueva Cita** (arriba a la derecha)
2. Seleccioná: cliente, vehículo, servicio, fecha y hora
3. Guardar

### Cambiar estado
Click en el badge de estado de una cita para ciclar entre los estados disponibles.

---

## 4. Clientes

**Menú lateral → 👥 Clientes**

### Listado
- Búsqueda por nombre, teléfono o email
- Cada cliente muestra sus datos y un botón **"Ver vehículos"**

### Nuevo cliente
1. Click en **+ Nuevo Cliente**
2. Completar: nombre, teléfono (obligatorios), email (opcional)

### Vehículos por cliente
1. Click en **"Ver vehículos"** junto a un cliente
2. Agregar vehículos: marca, modelo, año, patente
3. Eliminar vehículos con el botón 🗑

---

## 5. Servicios

**Menú lateral → 🔧 Servicios**

### Listado (todos los usuarios)
- Tabla con: nombre del servicio, descripción, duración en minutos, precio
- Visible para todos los usuarios del taller

### Administración (solo admin)
- **Crear:** Click en **+ Nuevo Servicio** → completar nombre, descripción, duración, precio
- **Vincular a modelos:** En el modal, tildar los modelos de vehículo compatibles con ese servicio
- **Editar:** Click en ✏️
- **Eliminar:** Click en 🗑 (confirma antes)

### Relación servicio ↔ modelo
Cuando vinculás un servicio a un modelo (ej: "Tren delantero completo" → "Ford Focus"), al crear una cita para un Focus se mostrará ese servicio como compatible.

---

## 6. Repuestos

**Menú lateral → 🔩 Repuestos**

### Listado (todos los usuarios)
- Búsqueda por nombre, marca o **número de parte**
- Columnas: Repuesto, N° Parte, Marca, Stock, Precio
- **Colores de stock:**
  - 🟢 Verde: stock ≥ 5
  - 🟠 Naranja: stock entre 1 y 4
  - 🔴 Rojo: stock = 0

### Administración (solo admin)
- **Crear:** Click en **+ Nuevo Repuesto** → completar:
  - **Nombre** (obligatorio)
  - **N° de Parte** (alfanumérico, máximo 30 caracteres, ej: `FD-MZ-2018`)
  - **Marca del repuesto** (ej: SKF, Monroe, Bosch)
  - **Stock** inicial
  - **Precio** unitario
  - **Año desde / Año hasta** (rango de compatibilidad)
  - **Modelos compatibles** (tildar checkboxes)
- **Editar:** Click en ✏️
- **Eliminar:** Click en 🗑 (confirma antes)

---

## 7. Modelos de Vehículos

**Menú lateral → 🚗 Modelos**

### Listado (todos los usuarios)
- Tabla de marcas y modelos con sus rangos de años
- Búsqueda por marca o modelo

### Administración (solo admin)
- **Crear:** Click en **+ Nuevo Modelo** → marca, modelo, año desde, año hasta
- **Automático:** Cuando un cliente registra un vehículo nuevo (vía WhatsApp o desde Clientes), el modelo se agrega automáticamente
- **Editar** ✏️ / **Eliminar** 🗑

---

## 8. Screensaver

Después de **5 minutos de inactividad** (sin mover el mouse ni tocar el teclado), la pantalla muestra el efecto de partículas con el nombre "Taller Pro".

- **Para volver:** presioná cualquier tecla
- Funciona en todas las pantallas de la aplicación

---

## 9. WhatsApp — Atender clientes con tu WhatsApp

### ¿Cómo funciona?

```
Cliente escribe a tu WhatsApp
    ↓
El bot (asistente IA) responde automáticamente
    ↓
Puede: listar servicios, consultar disponibilidad, agendar citas
```

El sistema usa **tu mismo número de WhatsApp**. No necesitás un chip nuevo ni un número separado. El bot funciona como un "dispositivo vinculado" adicional, igual que WhatsApp Web.

### ¿Qué puede hacer el bot?

| El cliente dice... | El bot responde... |
|---|---|
| "Hola, ¿qué servicios tienen?" | Lista los servicios con precios y duración |
| "¿Tenés turno para el viernes?" | Consulta los horarios disponibles |
| "Quiero agendar tren delantero" | Pide datos del vehículo, patente, fecha y hora |
| "Confirmame para el 26 a las 9" | Crea la cita y confirma |

El bot **recuerda la conversación** (últimos 10 mensajes), así que puede seguir el hilo de lo que el cliente va diciendo.

### Cómo activarlo (una sola vez)

> **Nota para el administrador técnico:** Estos pasos ya están documentados en detalle en `MANUAL_PUESTA_EN_MARCHA.md`, sección 2, Paso 5.

1. El técnico ejecuta comandos que generan un **código QR**
2. Abrís WhatsApp en tu celular
3. Andá a **Ajustes (⋮) → Dispositivos vinculados → Vincular un dispositivo**
4. Escaneás el QR
5. Listo. A partir de ese momento, cuando alguien te escriba, el bot responde solo

### ¿Cómo sé que está funcionando?

1. Pedile a alguien que te mande un WhatsApp a tu número
2. El bot debería responder en menos de 10 segundos
3. También podés mandarte un mensaje a vos mismo desde otro celular

### ¿Qué pasa si cambio de celular o formateo?

Hay que volver a generar el QR y escanearlo (el técnico lo hace en 2 minutos).

### ¿Afecta mi uso normal de WhatsApp?

**No.** El bot es un dispositivo vinculado adicional. Vos seguís usando WhatsApp normalmente en tu celular. El bot simplemente "lee" los mensajes que te llegan y responde por vos cuando corresponde. Si vos también respondés manualmente, no hay conflicto.

---

## 10. Roles de usuario

| Rol | Permisos |
|---|---|
| **Admin** | Acceso total: crear/editar/borrar servicios, repuestos, modelos. Ver todo |
| **Operario** | Ver dashboard, citas, clientes, servicios y repuestos. Crear/editar citas y clientes. **No puede** modificar servicios, repuestos ni modelos |

---

## 11. Producción

La versión en producción está disponible en `https://rdbmam.net`. Cualquier cambio que se suba al repositorio se publica automáticamente en ese dominio (Cloudflare Pages).
