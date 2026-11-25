/**
 * Rutas públicas de Wallet (Google Wallet; Apple Wallet en una fase posterior).
 * La tarjeta se identifica por su qr_token (secreto de 128 bits que ya trae el QR del cliente).
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import LoyaltyCard from '../models/LoyaltyCard.js';
import { isGoogleWalletConfigured, createGoogleSaveUrl } from '../services/googleWalletService.js';

const router = express.Router();

const walletLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes, intenta más tarde' }
});

// Qué wallets están disponibles (el frontend solo muestra los botones configurados)
router.get('/status', (req, res) => {
  res.json({ success: true, data: { google: isGoogleWalletConfigured(), apple: false } });
});

// Enlace "Agregar a Google Wallet"
router.get('/google/:qrToken', walletLimiter, async (req, res) => {
  try {
    if (!isGoogleWalletConfigured()) {
      return res.status(503).json({ success: false, message: 'Google Wallet no está disponible' });
    }
    const qrToken = String(req.params.qrToken || '').trim();
    if (!/^[\w-]{8,128}$/.test(qrToken)) {
      return res.status(400).json({ success: false, message: 'Tarjeta inválida' });
    }
    const card = await LoyaltyCard.findOne({ qr_token: qrToken }).select('_id estado');
    if (!card) {
      return res.status(404).json({ success: false, message: 'Tarjeta no encontrada' });
    }
    if (card.estado !== 'activa') {
      return res.status(400).json({ success: false, message: `La tarjeta está ${card.estado}` });
    }
    const saveUrl = await createGoogleSaveUrl(card._id);
    res.json({ success: true, data: { saveUrl } });
  } catch (error) {
    console.error('[GoogleWallet] Error generando enlace:', error.message);
    res.status(502).json({ success: false, message: 'No se pudo conectar con Google Wallet. Intenta más tarde.' });
  }
});

export default router;
