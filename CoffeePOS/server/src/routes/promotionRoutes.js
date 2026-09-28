import express from 'express';
import { requireAdmin } from '../middlewares/authMiddleware.js';
import { getPromotions, createPromotion, updatePromotion, togglePromotion, deletePromotion } from '../controllers/promotionController.js';

const router = express.Router();

// GET /api/promotions - Obtener todas las promociones (filtradas por cliente y estado)
router.get('/', getPromotions);

// POST /api/promotions - Crear nueva promoción (Admin solo)
router.post('/', requireAdmin, createPromotion);

// PUT /api/promotions/:id - Actualizar promoción (Admin solo)
router.put('/:id', requireAdmin, updatePromotion);

// PATCH /api/promotions/:id/toggle - Activar/desactivar promoción (Admin solo)
router.patch('/:id/toggle', requireAdmin, togglePromotion);

// DELETE /api/promotions/:id - Eliminar promoción (Admin solo)
router.delete('/:id', requireAdmin, deletePromotion);

export default router;