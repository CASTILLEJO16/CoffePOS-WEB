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

        // Auto-reparación: si el usuario no tiene clientId (migración legacy), asignar uno
        let clientId = user.clientId || decoded.clientId;
        if (!clientId) {
          try {
            let defaultClient = await Client.findOne().sort({ createdAt: 1 });
            if (!defaultClient) {
              defaultClient = await Client.create({
                name: 'Default Client',
                email: `default-${Date.now()}@coffeepos.local`,
                status: 'active'
              });
              console.log(`[authMiddleware] Cliente por defecto creado: ${defaultClient._id}`);
            }
            clientId = defaultClient._id;
            // Actualizar usuario con clientId faltante
            await User.findByIdAndUpdate(user._id, { clientId });
            console.log(`[authMiddleware] Usuario ${user.usuario} migrado a clientId ${clientId}`);
          } catch (e) {
            console.error('[authMiddleware] Error auto-asignando clientId:', e.message);
          }
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
