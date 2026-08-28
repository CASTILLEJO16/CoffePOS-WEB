import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/config.js';
import { requestLogger } from './middlewares/logMiddleware.js';
import { errorHandler, notFoundHandler } from './middlewares/errorMiddleware.js';
import { connectDB } from './config/database.js';

// Importar rutas
import productRoutes from './routes/productRoutes.js';
import saleRoutes from './routes/saleRoutes.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import customizationRoutes from './routes/customizationRoutes.js';
import cashRegisterRoutes from './routes/cashRegisterRoutes.js';
import almacenRoutes from './routes/almacenRoutes.js';
import configRoutes from './routes/configRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import licenseRoutes from './routes/licenseRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicializar Express
const app = express();

// Middlewares globales
app.use(helmet({
  crossOriginResourcePolicy: false
}));
app.use(cors({
  origin: (origin, callback) => {
    // Construir lista de orígenes permitidos a partir de variables de entorno
    const envOrigins = [
      process.env.FRONTEND_URL,
      process.env.DEVELOPER_PANEL_URL
    ].filter(Boolean);

    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      ...envOrigins
    ];

    // Sin origin (Postman, Render health checks, mobile apps)
    if (!origin) return callback(null, true);
    // Origen permitido explícitamente
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Localhost en cualquier puerto (desarrollo local)
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) return callback(null, true);
    // Dominios de vercel/render propios
    if (origin.includes('.vercel.app') || origin.includes('.onrender.com')) return callback(null, true);

    console.warn(`CORS bloqueó: ${origin}`);
    return callback(null, false);
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(requestLogger);

// Rate limit global para API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000
});
app.use('/api', apiLimiter);

// Servir imágenes de productos como archivos estáticos
// Debe coincidir con la lógica de src/config/upload.js (soporte para ELECTRON_USER_DATA)
const uploadsPath = process.env.ELECTRON_USER_DATA
  ? path.join(process.env.ELECTRON_USER_DATA, 'uploads')
  : path.join(__dirname, '../../uploads');
app.use('/uploads', express.static(uploadsPath));

// Rutas API
app.use('/api/productos', productRoutes);
app.use('/api/ventas', saleRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', userRoutes);
app.use('/api/personalizaciones', customizationRoutes);
app.use('/api/cajas', cashRegisterRoutes);
app.use('/api/almacen', almacenRoutes);
app.use('/api/configuracion', configRoutes);
app.use('/api/categorias', categoryRoutes);
app.use('/api/clientes', clientRoutes);
app.use('/api/licencias', licenseRoutes);

// Ruta de health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Coffee POS API funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Manejo de errores
app.use(notFoundHandler);
app.use(errorHandler);

// Iniciar servidor
const PORT = process.env.PORT || config.port;

async function startServer() {
  try {
    // Conectar a MongoDB
    await connectDB();
    
    app.listen(PORT, () => {
      console.log(`🚀 Servidor Coffee POS corriendo en puerto ${PORT}`);
      console.log(`📡 API disponible en http://localhost:${PORT}`);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🔑 Usuario admin por defecto: admin / admin123`);
      }
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error.message);
    process.exit(1);
  }
}

startServer();

export default app;
