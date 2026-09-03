import express from 'express';
import { authenticateToken, requireAdmin } from '../middlewares/authMiddleware.js';
import {
  createClient,
  getClients,
  getClientById,
  updateClient,
  deleteClient,
  getClientLicenses,
  getMyClient
} from '../controllers/clientController.js';

const router = express.Router();

// Ruta para cafetería autenticada (cualquier rol) - solo lectura, edición solo desde DeveloperPanel
router.get('/me', authenticateToken, getMyClient);

// Todas las rutas de administración de clientes requieren estar autenticado como Admin
router.use(authenticateToken, requireAdmin);

router.post('/', createClient);
router.get('/', getClients);
router.get('/:id', getClientById);
router.put('/:id', updateClient);
router.delete('/:id', deleteClient);
router.get('/:id/licenses', getClientLicenses);

export default router;
