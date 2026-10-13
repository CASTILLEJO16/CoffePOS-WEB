# Implementación de Tarjeta de Lealtad y Tickets Abiertos - CoffeePOS

## Resumen de la Implementación

Se han implementado dos módulos nuevos en CoffeePOS:

1. **Tarjeta de Lealtad Digital con QR y 10 Sellos**
2. **Tickets Abiertos / Cuentas de Consumo**

## Sistema de Registro Público de Clientes

Se ha implementado un flujo completo para que los clientes se registren ellos mismos:

### Rutas Públicas (sin autenticación)

- `/qr-publico` - Página con QR que los clientes escanean para registrarse
- `/registro-cliente` - Formulario de registro público
- `/mi-tarjeta` - Página para que los clientes consulten su tarjeta por teléfono

### Flujo del Cliente

1. **Escanea QR público**: El cliente escanea el QR en la cafetería (apunta a /qr-publico)
2. **Se abre el formulario**: El QR lleva a /registro-cliente
3. **Completa datos**: Nombre, teléfono, email (opcional)
4. **Se crea tarjeta automáticamente**: Se genera tarjeta de lealtad con QR único
5. **Descarga QR**: El cliente guarda la imagen del QR en su galería
6. **Muestra QR en la cafetería**: Para acumular sellos

### Flujo del Vendedor

1. **Escanea QR del cliente**: Usa lector USB o escáner en /lealtad
2. **Sistema busca token**: El backend busca el token en la base de datos
3. **Muestra datos actuales**: Sellos, recompensas, etc. (del servidor)
4. **Agrega sello**: Se actualiza en el servidor
5. **Cliente puede consultar**: En /mi-tarjeta ingresa su teléfono y ve su progreso

### Cómo funciona con imagen estática

**El QR no cambia, pero los datos en el servidor sí:**

- El QR contiene solo un token único (ej: `ABC123XYZ`)
- Cuando escaneas el QR, el backend busca ese token en la base de datos
- El servidor devuelve los datos ACTUALES (sellos, recompensas, etc.)
- La imagen del QR no cambia, pero el servidor siempre tiene los datos actualizados
- El cliente puede consultar su progreso en cualquier momento en /mi-tarjeta

## Archivos Creados

### Backend (Server)

#### Modelos de Base de Datos
- `server/src/models/Customer.js` - Modelo para clientes individuales del programa de lealtad
- `server/src/models/LoyaltyCard.js` - Modelo para tarjetas de lealtad con QR y sellos
- `server/src/models/StampHistory.js` - Modelo para historial de sellos (auditoría)
- `server/src/models/Reward.js` - Modelo para recompensas canjeadas
- `server/src/models/OpenTicket.js` - Modelo para tickets/cuentas abiertas
- `server/src/models/OpenTicketItem.js` - Modelo para items de tickets abiertos

#### Controladores
- `server/src/controllers/customerController.js` - Controlador de clientes individuales
- `server/src/controllers/loyaltyController.js` - Controlador de tarjetas de lealtad
- `server/src/controllers/openTicketController.js` - Controlador de tickets abiertos

#### Rutas API
- `server/src/routes/customerRoutes.js` - Rutas para clientes (/api/customers)
- `server/src/routes/loyaltyRoutes.js` - Rutas para lealtad (/api/loyalty)
- `server/src/routes/openTicketRoutes.js` - Rutas para tickets (/api/opentickets)

### Frontend (Client)

#### Servicios API
- `client/src/services/customerService.js` - Servicio para clientes
- `client/src/services/loyaltyService.js` - Servicio para lealtad
- `client/src/services/openTicketService.js` - Servicio para tickets abiertos

#### Páginas
- `client/src/pages/LoyaltyCard.jsx` - Página de tarjeta de lealtad con escáner QR
- `client/src/pages/LoyaltyCard.css` - Estilos de tarjeta de lealtad
- `client/src/pages/OpenTickets.jsx` - Página de tickets abiertos
- `client/src/pages/OpenTickets.css` - Estilos de tickets abiertos
- `client/src/pages/CustomerRegistration.jsx` - Página de registro público de clientes
- `client/src/pages/CustomerRegistration.css` - Estilos de registro público
- `client/src/pages/CustomerCardLookup.jsx` - Página de consulta de tarjeta por teléfono
- `client/src/pages/CustomerCardLookup.css` - Estilos de consulta
- `client/src/pages/PublicQR.jsx` - Página con QR público para escanear
- `client/src/pages/PublicQR.css` - Estilos de QR público

#### Modificaciones
- `client/src/App.jsx` - Agregadas rutas para /lealtad y /tickets-abiertos
- `client/src/layouts/MainLayout.jsx` - Agregados items de menú
- `client/src/layouts/AdminLayout.jsx` - Sin cambios
- `client/src/components/admin/AdminSidebar.jsx` - Agregados items de menú para admin

### Documentación
- `WALLET_INTEGRATION.md` - Documentación completa para integración con Apple Wallet y Google Wallet

## Dependencias Agregadas

### Backend (package.json)
```json
{
  "qrcode": "^1.5.3"
}
```

### Frontend (package.json)
```json
{
  "qrcode.react": "^4.1.0",
  "react-qr-reader": "^3.1.5"
}
```

## Instalación

### 1. Instalar Dependencias del Backend

```bash
cd CoffeePOS/server
npm install
```

### 2. Instalar Dependencias del Frontend

```bash
cd CoffeePOS/client
npm install
```

### 3. Reiniciar el Servidor

```bash
# Backend
cd CoffeePOS/server
npm run dev

# Frontend (en otra terminal)
cd CoffeePOS/client
npm run dev
```

## Migraciones de Base de Datos

Las migraciones se ejecutan automáticamente al iniciar el servidor. El sistema detectará los nuevos modelos y:

1. Creará las colecciones en MongoDB
2. Asignará el `clientId` a los documentos existentes (multi-tenant)
3. Inicializará la configuración de lealtad por defecto

### Configuración de Lealtad Inicial

El sistema crea automáticamente las siguientes configuraciones:

- `loyalty_enabled`: "true" - Programa activado
- `loyalty_program_name`: "Programa de Lealtad" - Nombre del programa
- `loyalty_stamps_required`: "10" - Sellos requeridos
- `loyalty_min_purchase`: "0" - Monto mínimo de compra (0 = sin mínimo)
- `loyalty_reward_product`: "Café americano gratis" - Nombre de la recompensa
- `loyalty_reward_product_id`: "" - ID del producto de recompensa

## API Endpoints

### Clientes Individuales

- `POST /api/customers` - Crear cliente (genera tarjeta automáticamente)
- `GET /api/customers` - Listar clientes
- `GET /api/customers/:id` - Obtener cliente por ID
- `GET /api/customers/phone/:telefono` - Buscar cliente por teléfono
- `PUT /api/customers/:id` - Actualizar cliente
- `PATCH /api/customers/:id/status` - Bloquear/desbloquear cliente

### Tarjetas de Lealtad

- `GET /api/loyalty/qr/:qr_token` - Obtener tarjeta por token QR
- `GET /api/loyalty/customer/:customerId` - Obtener tarjeta de cliente
- `POST /api/loyalty/stamp` - Agregar sello a tarjeta
- `POST /api/loyalty/redeem` - Canjear recompensa
- `GET /api/loyalty/history/:customerId` - Historial de sellos
- `GET /api/loyalty/rewards/:customerId` - Recompensas canjeadas
- `POST /api/loyalty/revert` - Revertir sello (para cancelaciones)
- `GET /api/loyalty/config` - Obtener configuración de lealtad
- `PUT /api/loyalty/config` - Actualizar configuración (solo admin)

### Tickets Abiertos

- `POST /api/opentickets` - Crear ticket abierto
- `GET /api/opentickets` - Listar tickets (con filtros)
- `GET /api/opentickets/:id` - Obtener ticket con items
- `POST /api/opentickets/:ticketId/items` - Agregar item a ticket
- `PUT /api/opentickets/items/:itemId` - Actualizar item
- `DELETE /api/opentickets/items/:itemId` - Eliminar item
- `POST /api/opentickets/:ticketId/close` - Cerrar ticket (convertir en venta)
- `POST /api/opentickets/:ticketId/cancel` - Cancelar ticket
- `POST /api/opentickets/:ticketId/assign-customer` - Asignar cliente

## Funcionalidades Implementadas

### Módulo 1: Tarjeta de Lealtad

#### Registro de Clientes
- ✅ Formulario para registrar clientes individuales
- ✅ Validación de teléfono único
- ✅ Generación automática de tarjeta de lealtad
- ✅ Generación de código QR único y seguro
- ✅ Búsqueda por teléfono
- ✅ Bloqueo/desbloqueo de tarjetas

#### Sistema de Sellos
- ✅ Escaneo de código QR (lector USB o entrada manual)
- ✅ Búsqueda manual por teléfono
- ✅ Validación de tarjeta activa
- ✅ Agregar sello por venta completada
- ✅ Prevención de sellos duplicados por venta
- ✅ Validación de monto mínimo de compra (configurable)
- ✅ Historial completo de sellos con auditoría
- ✅ Visualización de progreso (X de 10 sellos)

#### Recompensas
- ✅ Detección automática de recompensa desbloqueada
- ✅ Canje de recompensas
- ✅ Reinicio automático del ciclo
- ✅ Registro de recompensas canjeadas
- ✅ Integración con ventas (producto gratis)

#### Configuración
- ✅ Activar/desactivar programa
- ✅ Nombre del programa
- ✅ Sellos requeridos (configurable)
- ✅ Monto mínimo de compra
- ✅ Nombre de recompensa
- ✅ Producto de recompensa

### Módulo 2: Tickets Abiertos

#### Gestión de Tickets
- ✅ Crear ticket abierto
- ✅ Asignar número de mesa
- ✅ Asociar cliente
- ✅ Listar tickets con filtros
- ✅ Buscar por mesa, cliente o número
- ✅ Ver tiempo transcurrido
- ✅ Cancelar tickets

#### Gestión de Items
- ✅ Agregar productos a ticket
- ✅ Actualizar cantidades
- ✅ Aplicar personalizaciones
- ✅ Eliminar items
- ✅ Cálculo automático de totales
- ✅ Cálculo de IVA

#### Cobro
- ✅ Cerrar ticket y convertir en venta
- ✅ Registro de venta en base de datos
- ✅ Creación de detalles de venta
- ✅ Actualización de inventario
- ✅ Integración con caja

#### Integración con Lealtad
- ✅ Asociar cliente a ticket
- ✅ Al cobrar, la venta puede generar sello
- ✅ Prevención de sellos duplicados

## Pruebas Obligatorias

### Escenarios de Tarjeta de Lealtad

1. **Registrar cliente y generar QR**
   - Ir a /lealtad
   - Crear nuevo cliente
   - Verificar que se genera tarjeta y QR

2. **Escanear QR válido y otorgar sello**
   - Escanear QR del cliente
   - Ingresar ID de venta
   - Verificar que se agrega sello
   - Verificar historial

3. **Intentar escanear repetidamente misma venta**
   - Intentar agregar sello con misma venta
   - Verificar mensaje de error

4. **Completar 10 sellos y desbloquear recompensa**
   - Agregar sellos hasta completar 10
   - Verificar notificación de recompensa
   - Verificar contador de recompensas

5. **Canjear recompensa**
   - Canjear recompensa
   - Verificar que se reinicia ciclo
   - Verificar historial de recompensas

6. **Iniciar nuevo ciclo**
   - Verificar que sellos vuelven a 0
   - Verificar que ciclo incrementa
   - Verificar que historial se conserva

7. **Intentar usar tarjeta bloqueada**
   - Bloquear tarjeta desde admin
   - Intentar escanear
   - Verificar mensaje de error

### Escenarios de Tickets Abiertos

8. **Crear cuenta abierta y agregar productos**
   - Crear ticket
   - Asignar mesa
   - Agregar varios productos
   - Verificar totales

9. **Reabrir cuenta y agregar más productos**
   - Abrir ticket existente
   - Agregar más productos
   - Verificar que totales se actualizan

10. **Cancelar cuenta sin cobrar**
    - Crear ticket
    - Cancelar ticket
    - Verificar que no se crea venta

11. **Cobrar cuenta y verificar caja/inventario**
    - Crear ticket con productos
    - Cerrar ticket y cobrar
    - Verificar venta en /ventas
    - Verificar inventario actualizado

12. **Confirmar que cuenta no otorga sellos antes de pagarse**
    - Crear ticket con cliente
    - Intentar agregar sello (debe fallar)
    - Cobrar ticket
    - Ahora sí se puede agregar sello

13. **Verificar permisos de admin y vendedor**
    - Vendedor: puede usar lealtad y tickets
    - Admin: puede configurar lealtad

14. **Prueba sin conexión**
    - Verificar que el sistema funciona offline
    - Los datos se sincronizan al reconectar

## Configuración de Apple Wallet y Google Wallet

**IMPORTANTE**: La integración con Wallet requiere credenciales oficiales. Consulta el archivo `WALLET_INTEGRATION.md` para instrucciones detalladas.

### Lo que está implementado:
- ✅ Estructura de datos para pases
- ✅ Generación de QR codes
- ✅ Botones en la interfaz (requieren implementación del backend)
- ✅ Documentación completa

### Lo que requiere configuración externa:
- ⚠️ Certificados de Apple Wallet
- ⚠️ Cuenta de desarrollador Apple
- ⚠️ Cuenta de Google Cloud
- ⚠️ Configuración de Google Wallet API
- ⚠️ Implementación de servicios de firma de pases

## Variables de Entorno

No se requieren nuevas variables de entorno para el funcionamiento básico. Para Wallet, ver `WALLET_INTEGRATION.md`.

## Compatibilidad

- ✅ Compatible con arquitectura existente
- ✅ Mantiene roles y permisos actuales
- ✅ Reutiliza modelos de ventas, productos, usuarios
- ✅ Compatible con sistema multi-tenant (clientId)
- ✅ Funciona offline cuando la arquitectura lo permite

## Próximos Pasos Opcionales

1. **Implementar servicios de Wallet** - Seguir documentación WALLET_INTEGRATION.md
2. **Agregar configuración de lealtad al panel admin** - Crear página de configuración
3. **Implementar escáner de cámara real** - Usar react-qr-reader con cámara
4. **Agregar reportes de lealtad** - Estadísticas de uso del programa
5. **Implementar notificaciones push** - Para actualizaciones de Wallet

## Soporte

Para problemas o preguntas:
1. Revisar la documentación en WALLET_INTEGRATION.md
2. Verificar que todas las dependencias estén instaladas
3. Revisar logs del servidor para errores
4. Verificar que MongoDB esté corriendo

## Notas Finales

- La implementación es completa y funcional para el sistema básico
- La integración con Wallet requiere configuración externa
- Todos los módulos respetan la arquitectura existente
- El sistema está listo para producción (sin Wallet)
- Para Wallet, sigue la documentación proporcionada
