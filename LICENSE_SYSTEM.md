# Sistema de Licencias - Coffee POS

## Descripción
Sistema completo de gestión de licencias para controlar el acceso al sistema Coffee POS. Permite ofrecer periodos de prueba (7-15 días), gestionar suscripciones, y controlar dispositivos.

## 🏗️ Arquitectura

El sistema de licencias está dividido en dos partes:

### 1. Panel de Desarrollador (DeveloperPanel)
- **Ubicación**: `DeveloperPanel/`
- **Propósito**: Panel exclusivo para el desarrollador
- **Funciones**: Gestionar cafeterías, generar licencias, controlar dispositivos
- **Acceso**: SOLO desarrollador (no se entrega a clientes)
- **Puerto**: 3002 (desarrollo)

### 2. Sistema Coffee POS (CoffeePOS/client)
- **Ubicación**: `CoffeePOS/client/`
- **Propósito**: Sistema que se entrega a los clientes
- **Funciones**: Punto de venta, administración, etc.
- **Acceso**: Clientes que compran el sistema
- **Puerto**: 3000 (desarrollo)

### 3. Backend Compartido (CoffeePOS/server)
- **Ubicación**: `CoffeePOS/server/`
- **Propósito**: API compartida por ambos sistemas
- **Funciones**: Rutas de licencias, autenticación, etc.
- **Puerto**: 3001 (desarrollo)

## Características

### Gestión de Clientes
- Crear, editar y eliminar clientes
- Información de contacto y negocio
- Estado del cliente (activo, bloqueado, expirado)

### Gestión de Licencias
- Generar licencias con diferentes tipos:
  - **Trial**: Prueba gratuita (7-15 días)
  - **Subscription**: Suscripción mensual/anual
  - **Lifetime**: Licencia vitalicia
- Control de duración y fecha de expiración
- Límite de dispositivos por licencia
- Extender licencias existentes
- Activar/bloquear licencias

### Gestión de Dispositivos
- Registro de dispositivos por licencia
- Límite de dispositivos activos
- Bloquear dispositivos específicos
- Liberar dispositivos para permitir nuevos registros
- Información del dispositivo (OS, browser, IP)

### Seguridad
- **Firma digital**: Cada licencia tiene una firma HMAC-SHA256
- **Verificación de integridad**: Las licencias no pueden ser modificadas
- **Middleware de verificación**: Protección de rutas sensibles
- **Clave secreta**: Configurable vía variable de entorno

## Arquitectura

### Backend (Node.js + Express + MongoDB)

#### Modelos de Datos
- **Client**: Información del cliente
- **License**: Información de la licencia con firma digital
- **Device**: Dispositivos registrados por licencia

#### Servicios
- `licenseService.js`: Lógica de negocio de licencias
  - Generación de claves únicas
  - Firma y verificación digital
  - Gestión de dispositivos
  - Verificación de licencias

#### Controladores
- `clientController.js`: Gestión de clientes
- `licenseController.js`: Gestión de licencias y dispositivos

#### Rutas
- `/api/clientes`: Gestión de clientes
- `/api/licencias`: Gestión de licencias y dispositivos

#### Middleware
- `licenseMiddleware.js`: Verificación de licencias en rutas protegidas

### Frontend (React)

#### Componentes
- `Licencias.jsx`: Panel de administración de licencias
- `Licencias.css`: Estilos del panel

#### Servicios
- `licenseService.js`: Cliente API para licencias

## Instalación

### Backend

1. Agregar variable de entorno:
```env
LICENSE_SECRET_KEY=tu_license_secret_key_super_seguro_aqui
```

2. Los modelos y rutas ya están integrados en `server.js`

### Frontend

1. El panel de licencias está disponible en `/admin/licencias`
2. Agregado al menú del sidebar administrativo

## Uso

### Flujo de Trabajo Típico

1. **Crear Cliente**
   - Ir al panel de licencias
   - Click en "Crear Cliente"
   - Llenar información del cliente

2. **Generar Licencia**
   - Click en "Generar Licencia"
   - Seleccionar cliente
   - Configurar tipo (trial/subscription/lifetime)
   - Establecer duración (días)
   - Configurar máximo de dispositivos

3. **Entregar Licencia al Cliente**
   - Copiar la clave de licencia generada
   - El cliente la usa para activar su sistema

4. **Gestionar Dispositivos**
   - Ver dispositivos activos por licencia
   - Bloquear dispositivos sospechosos
   - Liberar dispositivos para permitir nuevos registros

5. **Extender Licencia**
   - Click en "Extender" en una licencia
   - Especificar días adicionales

### API Endpoints

#### Clientes
- `POST /api/clientes` - Crear cliente
- `GET /api/clientes` - Obtener todos los clientes
- `GET /api/clientes/:id` - Obtener cliente por ID
- `PUT /api/clientes/:id` - Actualizar cliente
- `DELETE /api/clientes/:id` - Eliminar cliente
- `GET /api/clientes/:id/licenses` - Obtener licencias del cliente

#### Licencias
- `POST /api/licencias/generate` - Generar licencia
- `GET /api/licencias` - Obtener todas las licencias
- `GET /api/licencias/:id` - Obtener licencia por ID
- `POST /api/licencias/extend` - Extender licencia
- `PUT /api/licencias/:id/block` - Bloquear licencia
- `PUT /api/licencias/:id/activate` - Activar licencia
- `GET /api/licencias/:id/devices` - Obtener dispositivos de licencia

#### Dispositivos
- `POST /api/licencias/device/block` - Bloquear dispositivo
- `POST /api/licencias/device/release` - Liberar dispositivo

#### Públicos (para clientes)
- `POST /api/licencias/verify` - Verificar licencia
- `POST /api/licencias/device/activate` - Activar dispositivo

## Seguridad

### Firma Digital
Cada licencia tiene una firma HMAC-SHA256 generada con:
- Clave de licencia
- ID del cliente
- Tipo de licencia
- Duración
- Fechas
- Máximo de dispositivos

Esta firma se verifica en cada petición para asegurar que la licencia no ha sido modificada.

### Middleware de Verificación
Para proteger rutas que requieren licencia válida:
```javascript
import { verifyLicenseMiddleware } from '../middlewares/licenseMiddleware.js';

router.get('/ruta-protegida', verifyLicenseMiddleware, controller);
```

El middleware verifica:
- Licencia válida
- Firma digital correcta
- Licencia no expirada
- Licencia no bloqueada
- Dispositivo registrado y activo

## Configuración de Periodos de Prueba

### Prueba de 7 días
```javascript
{
  type: 'trial',
  durationDays: 7,
  maxDevices: 1
}
```

### Prueba de 15 días
```javascript
{
  type: 'trial',
  durationDays: 15,
  maxDevices: 1
}
```

## Integración con Sistema Existente

El sistema de licencias está completamente integrado con:
- Sistema de autenticación existente
- Panel administrativo
- Base de datos MongoDB existente

Los administradores pueden acceder al panel de licencias desde el sidebar del panel admin.

## Notas Importantes

1. **Clave Secreta**: La `LICENSE_SECRET_KEY` debe ser única y segura. No compartirla.
2. **Backup**: Realizar backups regulares de la base de datos de licencias.
3. **Monitoreo**: Monitorear el uso de licencias y dispositivos.
4. **Renovaciones**: Implementar sistema de notificaciones para renovaciones próximas.
5. **Dispositivos**: Liberar dispositivos cuando los clientes cambian de hardware.

## Futuras Mejoras

- Sistema de pagos integrado
- Notificaciones automáticas de expiración
- Dashboard de analytics de licencias
- Exportación de reportes
- API para integración con terceros
- Sistema de reventa
