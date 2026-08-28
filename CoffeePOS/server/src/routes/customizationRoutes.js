import express from 'express';
import * as customizationController from '../controllers/customizationController.js';
import { authenticateToken, requireAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Todas las rutas requieren autenticación para aislamiento por clientId
router.use(authenticateToken);

router.get('/', customizationController.getCustomizations);
router.get('/:id', customizationController.getCustomization);

// Rutas de administración (requieren rol admin)
router.post('/', requireAdmin, customizationController.createCustomization);
router.put('/:id', requireAdmin, customizationController.updateCustomization);
router.delete('/:id', requireAdmin, customizationController.deleteCustomization);

export default router;
