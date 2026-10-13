/**
 * Rutas para Clientes Individuales (API REST)
 */

import express from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import * as customerController from '../controllers/customerController.js';

const router = express.Router();

// Rutas públicas (sin autenticación) - para registro de clientes
router.post('/public-register', customerController.createCustomer);
router.get('/public-lookup/:telefono', customerController.getCustomerByPhone);

// Rutas protegidas (requieren autenticación)
router.use(authenticate);

// CRUD de clientes
router.post('/', customerController.createCustomer);
router.get('/', customerController.getCustomers);
router.get('/:id', customerController.getCustomerById);
router.put('/:id', customerController.updateCustomer);
router.patch('/:id/status', customerController.toggleCustomerStatus);

// Ruta protegida para buscar por teléfono
router.get('/phone/:telefono', customerController.getCustomerByPhone);

export default router;
