/**
 * Rutas para Tarjetas de Lealtad (API REST)
 */

import express from 'express';
import { authenticateToken as authenticate } from '../middlewares/authMiddleware.js';
import * as loyaltyController from '../controllers/loyaltyController.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Obtener tarjeta por QR
router.get('/qr/:qr_token', loyaltyController.getCardByQRToken);

// Obtener tarjeta de cliente
router.get('/customer/:customerId', loyaltyController.getCustomerCard);

// Agregar sello
router.post('/stamp', loyaltyController.addStamp);

// Canjear recompensa
router.post('/redeem', loyaltyController.redeemReward);

// Historial de sellos
router.get('/history/:customerId', loyaltyController.getStampHistory);

// Recompensas canjeadas
router.get('/rewards/:customerId', loyaltyController.getRewards);

// Revertir sello
router.post('/revert', loyaltyController.revertStamp);

// Configuración de lealtad
router.get('/config', loyaltyController.getLoyaltyConfig);
router.put('/config', loyaltyController.updateLoyaltyConfig);

// Obtener todas las tarjetas
router.get('/all', loyaltyController.getAllLoyaltyCards);

export default router;
