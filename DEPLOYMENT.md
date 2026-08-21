# Guía de Despliegue - Coffee POS

## Arquitectura
- **Frontend**: React + Vite desplegado en Vercel
- **Backend**: Node.js + Express + MongoDB desplegado en Render

## Repositorios
- **Frontend + Backend**: https://github.com/CASTILLEJO16/CoffePOS-WEB (todo junto)
- **Backend (opcional)**: https://github.com/CASTILLEJO16/CoffePOS-WEB-backend (repositorio separado)

## Despliegue del Backend (Render)

### 1. Preparar el Repositorio
El backend está en la carpeta `CoffeePOS/server/` dentro del repositorio principal.

### 2. Crear cuenta en Render
- Ve a [render.com](https://render.com)
- Crea una cuenta con tu GitHub

### 3. Crear Web Service
1. Click en "New +" → "Web Service"
2. Conecta tu repositorio: `CASTILLEJO16/CoffePOS-WEB`
3. Configura:
   - **Name**: coffeepos-backend
   - **Root Directory**: `CoffeePOS/server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

### 4. Variables de Entorno
Agrega estas variables en Render:
- `MONGODB_URI`: Tu conexión de MongoDB Atlas
- `PORT`: 3001
- `NODE_ENV`: production
- `JWT_SECRET`: Genera un string aleatorio seguro
- `FRONTEND_URL`: La URL de tu frontend en Vercel (la agregarás después)

### 5. Desplegar
Click en "Create Web Service" y espera el despliegue.

**Guarda la URL de tu backend** (ejemplo: `https://coffeepos-backend.onrender.com`)

**Nota**: El repositorio del backend ya tiene los archivos de configuración necesarios:
- `.env.example` - Plantilla de variables de entorno
- `render.yaml` - Configuración de despliegue (opcional)

## Despliegue del Frontend (Vercel)

### 1. Preparar el Repositorio
El frontend está en la carpeta `CoffeePOS/client/`

### 2. Crear cuenta en Vercel
- Ve a [vercel.com](https://vercel.com)
- Crea una cuenta con tu GitHub

### 3. Importar Proyecto
1. Click en "Add New Project"
2. Selecciona tu repositorio: `CASTILLEJO16/CoffePOS-WEB`
3. Configura:
   - **Framework Preset**: Vite
   - **Root Directory**: `CoffeePOS/client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

**Nota**: El repositorio del frontend ya tiene los archivos de configuración necesarios:
- `.env.example` - Plantilla de variables de entorno
- `vercel.json` - Configuración de despliegue
- `vite.config.js` - Configuración de Vite actualizada

### 4. Variables de Entorno
Agrega esta variable en Vercel:
- `VITE_API_URL`: La URL de tu backend en Render (ejemplo: `https://coffeepos-backend.onrender.com/api`)

### 5. Desplegar
Click en "Deploy" y espera el despliegue.

**Guarda la URL de tu frontend** (ejemplo: `https://coffeepos.vercel.app`)

## Actualizar el Backend

Regresa a Render y actualiza la variable `FRONTEND_URL` con la URL de tu frontend en Vercel.

## MongoDB Atlas Setup

1. Ve a [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Crea un cluster gratuito
3. Crea un usuario de base de datos
4. Configura Network Access para permitir conexiones desde cualquier IP (0.0.0.0/0)
5. Copia la conexión string y úsala como `MONGODB_URI` en Render

## Estructura de Archivos de Configuración

### Backend (Render)
- Ubicación: `CoffeePOS/server/` dentro del repositorio principal
- `.env.example` - Plantilla de variables de entorno
- `render.yaml` - Configuración de despliegue (opcional)

### Frontend (Vercel)
- Ubicación: `CoffeePOS/client/` dentro del repositorio principal
- `.env.example` - Plantilla de variables de entorno
- `vercel.json` - Configuración de despliegue
- `vite.config.js` - Configuración de Vite actualizada

## Troubleshooting

### Error 404 en Vercel
- Verifica que el Root Directory sea `CoffeePOS/client`
- Verifica que el Output Directory sea `dist`

### Error de conexión al backend
- Verifica que `VITE_API_URL` esté configurada correctamente en Vercel
- Verifica que el backend esté corriendo en Render
- Verifica que CORS esté configurado correctamente

### Error de conexión a MongoDB
- Verifica que `MONGODB_URI` sea correcta
- Verifica que Network Access en MongoDB Atlas permita conexiones
- Verifica que el usuario tenga permisos correctos

## URLs de Ejemplo

- **Frontend**: `https://coffeepos.vercel.app`
- **Backend**: `https://coffeepos-backend.onrender.com`
- **API**: `https://coffeepos-backend.onrender.com/api`
