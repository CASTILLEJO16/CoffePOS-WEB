import express from 'express';
import { authenticateToken, requireDeveloper } from '../middlewares/authMiddleware.js';
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

// Administración de cafeterías: SOLO developer (DeveloperPanel).
// Un admin de cafetería NO debe poder ver/crear/borrar otras cafeterías.
router.use(authenticateToken, requireDeveloper);

router.post('/', createClient);
router.get('/', getClients);
router.get('/:id', getClientById);
router.put('/:id', updateClient);
router.delete('/:id', deleteClient);
router.get('/:id/licenses', getClientLicenses);

export default router;
