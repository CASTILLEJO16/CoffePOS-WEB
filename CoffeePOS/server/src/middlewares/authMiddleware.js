import { verifyToken as verifyJWT } from '../services/authService.js';
import User from '../models/User.js';
import Client from '../models/Client.js';

/**
 * Middleware de autenticación
 * Verifica que el token JWT sea válido
 */
export function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Formato de autorización inválido'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token no proporcionado'
      });
    }

    const decoded = verifyJWT(token);

    // Verificar que el usuario siga activo
    User.findById(decoded.userId)
      .then(async user => {
        if (!user || !user.activo) {
          return res.status(403).json({
            success: false,
            error: 'Usuario inválido o inactivo'
          });
        }

        // Verificar que el usuario tenga clientId asignado (sin auto-reparación)
        const clientId = user.clientId || decoded.clientId;
        if (!clientId) {
          console.error(`[authMiddleware] Usuario ${user.usuario} sin clientId asignado. Requiere migración manual.`);
          return res.status(403).json({
            success: false,
            error: 'Usuario sin clientId asignado. Contacte al administrador.'
          });
        }

        req.user = {
          ...decoded,
          userId: decoded.userId,
          role: user.rol,
          rol: user.rol,
          clientId: clientId
        };

        next();
      })
      .catch((err) => {
        console.error('[authMiddleware] Error verificando usuario:', err?.message);
        return res.status(500).json({
          success: false,
          error: 'Error verificando usuario'
        });
      });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
    }
    return res.status(403).json({
      success: false,
      error: 'Token inválido o expirado'
    });
  }
}

/**
 * Middleware de autorización para administradores
 * Verifica que el usuario tenga rol de admin
 */
export function requireAdmin(req, res, next) {
  if (!req.user || (req.user.role !== 'admin' && req.user.rol !== 'admin')) {
    return res.status(403).json({
      success: false,
      error: 'Se requiere rol de administrador'
    });
  }
  next();
}

/**
 * Middleware opcional de autenticación
 * No falla si no hay token, pero agrega el usuario si existe
 */
export function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];

    if (token) {
      const decoded = verifyJWT(token);
      req.user = decoded;
    }
    
    next();
  } catch (error) {
    console.warn('Token inválido en optionalAuth');
    next();
  }
}

/**
 * Middleware de autorización para vendedores o administradores
 * Verifica que el usuario tenga rol de vendedor o admin
 */
export function requireSellerOrAdmin(req, res, next) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'cajero' && req.user.rol !== 'admin' && req.user.rol !== 'cajero')) {
    return res.status(403).json({
      success: false,
      error: 'Se requiere rol de vendedor o administrador'
    });
  }
  next();
}
