import express from 'express';
import { authenticateToken, requireAdmin } from '../middlewares/authMiddleware.js';
import {
  generateLicense,
  getLicenses,
  getLicenseById,
  extendLicense,
  blockLicense,
  activateLicense,
  getLicenseDevices,
  blockDevice,
  releaseDevice,
  verifyLicense,
  activateDevice,
  updateLicense
} from '../controllers/licenseController.js';

const router = express.Router();

// Rutas públicas (para clientes - SIN autenticación)
router.post('/public/verify', verifyLicense);
router.post('/public/activate', activateDevice);

// Rutas de licencias (administración - CON autenticación estricta de Admin)
router.use(authenticateToken, requireAdmin);

router.post('/generate', generateLicense);
router.get('/', getLicenses);
router.get('/:id', getLicenseById);
router.post('/extend', extendLicense);
router.put('/:id/block', blockLicense);
router.put('/:id/activate', activateLicense);
router.put('/:id', updateLicense);
router.get('/:id/devices', getLicenseDevices);

// Rutas de dispositivos (administración - CON autenticación)
router.post('/device/block', blockDevice);
router.post('/device/release', releaseDevice);

export default router;
