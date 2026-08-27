# Panel de Desarrollador - Coffee POS

Panel de administración exclusivo para el desarrollador de Coffee POS. Este panel NO se entrega a los clientes y permite gestionar todas las cafeterías que utilizan el sistema.

## 🚀 Características

- **Gestión de Cafeterías**: Registrar nuevas cafeterías como clientes
- **Generación de Licencias**: Crear licencias de prueba (7-15 días), suscripción o vitalicias
- **Control de Dispositivos**: Ver, bloquear y liberar dispositivos por licencia
- **Extensión de Periodos**: Extender licencias de prueba o suscripciones
- **Monitoreo**: Ver estado de todas las licencias y dispositivos activos

## 📋 Instalación

### Prerrequisitos
- Node.js 18+
- npm o yarn

### Pasos

1. **Instalar dependencias:**
```bash
cd DeveloperPanel
npm install
```

2. **Configurar variables de entorno:**
```bash
cp .env.example .env
```

Edita `.env` y configura la URL del backend:
```env
VITE_API_URL=http://localhost:3001/api
```

3. **Iniciar el servidor de desarrollo:**
```bash
npm run dev
```

El panel estará disponible en `http://localhost:3002`

## 🔧 Configuración

### Backend
El backend debe tener las rutas de licencias configuradas (ya están incluidas en el sistema principal).

### Variables de Entorno
- `VITE_API_URL`: URL del backend donde están las rutas de licencias

## 📖 Uso

### Registrar Nueva Cafetería
1. Click en "Registrar Cafetería"
2. Llenar el formulario con información del propietario y cafetería
3. Click en "Registrar Cafetería"

### Generar Licencia
1. Click en "Generar Licencia"
2. Seleccionar la cafetería
3. Configurar tipo (Prueba/Suscripción/Vitalicia)
4. Establecer duración en días
5. Configurar máximo de dispositivos
6. Click en "Generar Licencia"
7. Copiar la clave de licencia generada

### Gestionar Dispositivos
1. Click en "Dispositivos" en una licencia
2. Ver dispositivos activos con información (OS, browser, IP)
3. Bloquear dispositivos sospechosos
4. Liberar dispositivos para permitir nuevos registros

### Extender Licencia
1. Click en "Extender" en una licencia
2. Ingresar cantidad de días adicionales
3. Confirmar

## 🔒 Seguridad

- Este panel es SOLO para el desarrollador
- No se incluye en el sistema que se entrega a los clientes
- Usa las mismas rutas API que el sistema principal
- Las licencias tienen firma digital HMAC-SHA256

## 🌐 Despliegue

### Vercel
1. Crear proyecto en Vercel
2. Conectar repositorio (separado del sistema principal)
3. Configurar variable `VITE_API_URL` con la URL del backend en producción
4. Desplegar

### Otros servicios
El panel puede ser desplegado en cualquier servicio de hosting estático (Netlify, GitHub Pages, etc.)

## 📁 Estructura

```
DeveloperPanel/
├── src/
│   ├── pages/
│   │   └── Licencias.jsx       # Panel principal
│   ├── services/
│   │   └── licenseService.js   # Cliente API
│   ├── styles/
│   │   └── global.css          # Estilos globales
│   ├── App.jsx                 # Router
│   └── main.jsx                # Entry point
├── index.html
├── package.json
├── vite.config.js
└── .env.example
```

## 🔗 Integración con Backend

El panel usa las mismas rutas API que el sistema principal:
- `POST /api/clientes` - Crear cliente
- `GET /api/clientes` - Obtener clientes
- `POST /api/licencias/generate` - Generar licencia
- `GET /api/licencias` - Obtener licencias
- `PUT /api/licencias/:id/block` - Bloquear licencia
- `POST /api/licencias/device/block` - Bloquear dispositivo
- etc.

## 📝 Notas Importantes

1. **Separación Completa**: Este panel es un proyecto completamente separado del sistema Coffee POS que se entrega a los clientes.
2. **Acceso Exclusivo**: Solo el desarrollador debe tener acceso a este panel.
3. **Repositorio Separado**: Se recomienda mantener este panel en un repositorio privado separado.
4. **Backend Compartido**: El backend es el mismo para el sistema de clientes y este panel.

## 🚀 Próximas Mejoras

- Dashboard con estadísticas de uso
- Sistema de pagos integrado
- Notificaciones de expiración
- Exportación de reportes
- Autenticación adicional para el panel
- Historial de cambios en licencias
