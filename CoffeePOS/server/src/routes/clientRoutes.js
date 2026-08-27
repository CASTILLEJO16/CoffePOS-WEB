import express from 'express';
import { authenticateToken, requireAdmin } from '../middlewares/authMiddleware.js';
import {
  createClient,
  getClients,
  getClientById,
  updateClient,
  deleteClient,
  getClientLicenses
} from '../controllers/clientController.js';

const router = express.Router();

// Todas las rutas de administración de clientes requieren estar autenticado como Admin
router.use(authenticateToken, requireAdmin);

router.post('/', createClient);
router.get('/', getClients);
router.get('/:id', getClientById);
router.put('/:id', updateClient);
router.delete('/:id', deleteClient);
router.get('/:id/licenses', getClientLicenses);

export default router;
