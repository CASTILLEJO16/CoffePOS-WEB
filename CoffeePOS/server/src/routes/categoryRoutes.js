import express from 'express';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/categoryController.js';
import { authenticateToken, requireAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Obtener todas las categorías (cualquier usuario autenticado: el POS las necesita)
router.get('/', authenticateToken, getCategories);

// Crear / actualizar / eliminar categoría: solo admin
router.post('/', authenticateToken, requireAdmin, createCategory);
router.put('/:id', authenticateToken, requireAdmin, updateCategory);
router.delete('/:id', authenticateToken, requireAdmin, deleteCategory);

export default router;
