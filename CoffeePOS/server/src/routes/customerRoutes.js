/**
 * Rutas para Clientes Individuales (API REST)
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateToken as authenticate, requireAdmin } from '../middlewares/authMiddleware.js';
import * as customerController from '../controllers/customerController.js';

const router = express.Router();

// Límite para rutas públicas (evita registros masivos / búsqueda de teléfonos por fuerza bruta)
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes, intenta más tarde' }
});

// Rutas públicas (sin autenticación) - la cafetería se identifica con cafeId del enlace QR
router.get('/public-cafe/:cafeId', publicLimiter, customerController.getPublicCafeInfo);
router.post('/public-register', publicLimiter, customerController.createCustomer);
router.get('/public-lookup/:telefono', publicLimiter, customerController.publicLookupCustomer);

// Rutas protegidas (requieren autenticación)
router.use(authenticate);

// CRUD de clientes
router.post('/', customerController.createCustomer);
router.get('/', customerController.getCustomers);

// Ruta protegida para buscar por teléfono (antes de /:id)
router.get('/phone/:telefono', customerController.getCustomerByPhone);

router.get('/:id', customerController.getCustomerById);
router.put('/:id', customerController.updateCustomer);
// Baja / eliminación: solo el admin de la cafetería
router.patch('/:id/status', requireAdmin, customerController.toggleCustomerStatus);
router.delete('/:id', requireAdmin, customerController.deleteCustomer);

export default router;
