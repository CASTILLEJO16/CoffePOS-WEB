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
// __dirname = server/src, por eso es ../uploads (no ../../). En upload.js es ../../ porque está en src/config/.
const uploadsPath = process.env.ELECTRON_USER_DATA
  ? path.join(process.env.ELECTRON_USER_DATA, 'uploads')
  : path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath));
console.log(`[static] Sirviendo /uploads desde: ${uploadsPath}`);

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

async function migrateLegacyData() {
  try {
    const Client = (await import('./models/Client.js')).default;
    const User = (await import('./models/User.js')).default;
    const Product = (await import('./models/Product.js')).default;
    const Sale = (await import('./models/Sale.js')).default;
    const SaleDetail = (await import('./models/SaleDetail.js')).default;
    const Category = (await import('./models/Category.js')).default;
    const CashRegister = (await import('./models/CashRegister.js')).default;
    const Ingredient = (await import('./models/Ingredient.js')).default;
    const Personalization = (await import('./models/Personalization.js')).default;
    const Config = (await import('./models/Config.js')).default;
    const Log = (await import('./models/Log.js')).default;
    const Recipe = (await import('./models/Recipe.js')).default;
    const RecipePersonalization = (await import('./models/RecipePersonalization.js')).default;
    const CashRegisterName = (await import('./models/CashRegisterName.js')).default;

    let defaultClient = await Client.findOne().sort({ createdAt: 1 });
    if (!defaultClient) {
      defaultClient = await Client.create({
        name: 'Default Client',
        email: `default-${Date.now()}@coffeepos.local`,
        status: 'active'
      });
      console.log(`[migración] Cliente por defecto creado: ${defaultClient._id}`);
    }

    const clientId = defaultClient._id;

    const legacyUsers = await User.countDocuments({ clientId: { $exists: false } });
    const nullUsers = await User.countDocuments({ clientId: null });
    if (legacyUsers + nullUsers > 0) {
      const r = await User.updateMany({ $or: [{ clientId: { $exists: false } }, { clientId: null }] }, { $set: { clientId } });
      console.log(`[migración] Usuarios migrados: ${r.modifiedCount}`);
    }

    for (const [model, name] of [[Product, 'Productos'], [Sale, 'Ventas'], [SaleDetail, 'Detalles'], [Category, 'Categorías'], [CashRegister, 'Cajas'], [Ingredient, 'Ingredientes'], [Personalization, 'Personalizaciones'], [Recipe, 'Recetas'], [RecipePersonalization, 'RecetasPers'], [CashRegisterName, 'NombresCaja']]) {
      try {
        const count = await model.countDocuments({ $or: [{ clientId: { $exists: false } }, { clientId: null }] });
        if (count > 0) {
          const r = await model.updateMany({ $or: [{ clientId: { $exists: false } }, { clientId: null }] }, { $set: { clientId } });
          console.log(`[migración] ${name} migrados: ${r.modifiedCount}`);
        }
      } catch (e) { console.warn(`[migración] ${name} skip:`, e.message); }
    }

    // Eliminar índices únicos legacy que bloquean multi-tenant (clave, usuario, nombre)
    for (const [model, idxName] of [[Config, 'clave_1'], [Category, 'nombre_1'], [User, 'usuario_1']]) {
      try {
        const indexes = await model.collection.getIndexes();
        if (indexes[idxName]) {
          await model.collection.dropIndex(idxName);
          console.log(`[migración] Índice legacy ${idxName} eliminado`);
        }
      } catch (e) { /* índice no existe */ }
    }

    // Config legacy sin clientId: asignar solo si no existe duplicado por clave+clientId
    const legacyConfigs = await Config.find({ $or: [{ clientId: { $exists: false } }, { clientId: null }] });
    for (const cfg of legacyConfigs) {
      const exists = await Config.findOne({ clave: cfg.clave, clientId });
      if (!exists) {
        await Config.updateOne({ _id: cfg._id }, { $set: { clientId } });
        console.log(`[migración] Config ${cfg.clave} migrada`);
      } else {
        // duplicado legacy, eliminar global
        await Config.deleteOne({ _id: cfg._id });
        console.log(`[migración] Config legacy duplicada ${cfg.clave} eliminada`);
      }
    }

    // Inicializar datos por defecto si cliente nuevo sin datos
    try {
      const catCount = await Category.countDocuments({ clientId });
      if (catCount === 0) {
        const { initializeClientData } = await import('./services/clientInitializationService.js');
        await initializeClientData(clientId);
        console.log('[migración] Datos por defecto inicializados para', clientId);
      }
    } catch (e) { console.warn('[migración] init default data skip:', e.message); }
  } catch (e) {
    console.error('[migración] Error:', e.message);
  }
}

async function startServer() {
  try {
    // Conectar a MongoDB
    await connectDB();
    await migrateLegacyData();
    
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
