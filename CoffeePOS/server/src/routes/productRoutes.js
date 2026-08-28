import express from 'express';
import * as productController from '../controllers/productController.js';
import { authenticateToken, requireAdmin } from '../middlewares/authMiddleware.js';
import { upload } from '../config/upload.js';

const router = express.Router();

// Todas las rutas de productos requieren autenticación para garantizar aislamiento por clientId
router.use(authenticateToken);

router.get('/', productController.getProducts);
router.get('/categorias', productController.getCategories);

// Rutas de administración (requieren rol admin)
router.get('/admin/todos', requireAdmin, productController.getAllProducts);
router.post('/', requireAdmin, upload.single('imagen'), productController.createProduct);
router.put('/:id', requireAdmin, upload.single('imagen'), productController.updateProduct);
router.patch('/:id/activar', requireAdmin, productController.activateProduct);
router.patch('/:id/desactivar', requireAdmin, productController.deactivateProduct);
router.patch('/:id/descuento', requireAdmin, productController.applyProductDiscount);
router.delete('/:id', requireAdmin, productController.deleteProduct);

// Ruta para obtener producto por ID (protegida, debe ir al final)
router.get('/:id', productController.getProduct);

export default router;
