import express from 'express';
import * as authController from '../controllers/authController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limits contra fuerza bruta. Solo cuentan los intentos FALLIDOS
// (skipSuccessfulRequests), así el uso normal del POS no se bloquea.
const limiterMessage = { success: false, error: 'Demasiados intentos fallidos, intenta en 15 minutos', message: 'Demasiados intentos fallidos, intenta en 15 minutos' };

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 intentos fallidos por IP
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: limiterMessage
});

// PIN de 4 dígitos = solo 10,000 combinaciones: límite más estricto
const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15, // 15 intentos fallidos por IP
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: limiterMessage
});

const devLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: limiterMessage
});

// Validación básica de input
function validateLogin(req, res, next) {
  const { username, password, usuario, contraseña } = req.body || {};

  const user = username || usuario;
  const pass = password || contraseña;

  if (!user || !pass) {
    return res.status(400).json({
      success: false,
      message: 'Usuario y contraseña son requeridos'
    });
  }

  if (typeof user !== 'string' || typeof pass !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Formato inválido'
    });
  }

  next();
}

// Rutas públicas
router.post('/dev-login', devLoginLimiter, validateLogin, authController.devLogin);
router.post('/login', loginLimiter, validateLogin, authController.login);
router.post('/login-pin', pinLimiter, authController.loginPin);

// Rutas protegidas
router.post('/logout', authenticateToken, authController.logout);
router.post('/change-password', authenticateToken, authController.changePassword);
router.get('/verify', authenticateToken, authController.verifyToken);

export default router;
