import express from 'express';
import { authenticateToken, requireAdmin } from '../middlewares/authMiddleware.js';
import { getPromotions, createPromotion, updatePromotion, togglePromotion, deletePromotion } from '../controllers/promotionController.js';

const router = express.Router();

// GET /api/promotions - Obtener todas las promociones (filtradas por cliente y estado)
// Requiere autenticación (vendedores pueden consultar, admin puede modificar)
router.get('/', authenticateToken, getPromotions);

// POST /api/promotions - Crear nueva promoción (Admin solo)
router.post('/', authenticateToken, requireAdmin, createPromotion);

// PUT /api/promotions/:id - Actualizar promoción (Admin solo)
router.put('/:id', authenticateToken, requireAdmin, updatePromotion);

// PATCH /api/promotions/:id/toggle - Activar/desactivar promoción (Admin solo)
router.patch('/:id/toggle', authenticateToken, requireAdmin, togglePromotion);

// DELETE /api/promotions/:id - Eliminar promoción (Admin solo)
router.delete('/:id', authenticateToken, requireAdmin, deletePromotion);

export default router;