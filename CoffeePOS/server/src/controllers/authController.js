import * as authService from '../services/authService.js';
import { logAction } from '../services/logService.js';
import licenseService from '../services/licenseService.js';

/**
 * Controlador de Autenticación
 * Maneja las requests HTTP relacionadas con autenticación
 */

/**
 * Inicia sesión
 */
export async function login(req, res) {
  try {
    const { usuario, contraseña } = req.body;

    if (!usuario || !contraseña) {
      return res.status(400).json({
        success: false,
        error: 'Usuario y contraseña son requeridos'
      });
    }

    const result = await authService.login(usuario, contraseña);

    // Registrar inicio de sesión
    await logAction(result.user.id, 'LOGIN', `Usuario ${usuario} inició sesión`);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(401).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Inicia sesión con PIN de 4 dígitos - SCOPED POR CAFETERÍA
 * Resuelve clientId desde licencia (x-license-key + x-device-id) para evitar cross-tenant
 */
export async function loginPin(req, res) {
  try {
    const { pin, codigo } = req.body;
    const cleanPin = String(pin || codigo || '').trim();

    if (!cleanPin) {
      return res.status(400).json({
        success: false,
        error: 'PIN es requerido'
      });
    }

    // Resolver clientId desde headers de licencia (dispositivo activado)
    let clientId = null;
    const licenseKey = req.headers['x-license-key'] || req.body.licenseKey || req.body.license_key;
    const deviceId = req.headers['x-device-id'] || req.body.deviceId || req.body.device_id;

    if (licenseKey && deviceId) {
      try {
        const licResult = await licenseService.verifyLicense(licenseKey, deviceId);
        if (licResult.valid && licResult.client) {
          clientId = licResult.client._id || licResult.client.id || licResult.license?.client;
        } else {
          return res.status(403).json({
            success: false,
            error: licResult.reason || 'Licencia no válida. Activa el dispositivo.',
            code: 'LICENSE_INVALID'
          });
        }
      } catch (e) {
        return res.status(403).json({
          success: false,
          error: 'Error verificando licencia: ' + e.message,
          code: 'LICENSE_INVALID'
        });
      }
    } else if (req.body.clientId) {
      // Fallback: permitir clientId explícito si el front lo envía
      clientId = req.body.clientId;
    }

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'No se pudo identificar la cafetería. Activa la licencia del dispositivo primero.',
        code: 'LICENSE_REQUIRED'
      });
    }

    const result = await authService.loginWithPin(cleanPin, clientId);

    await logAction(result.user._id || result.user.id, 'LOGIN_PIN', `Usuario ${result.user.usuario} inició sesión con PIN`);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error en loginPin:', error);
    res.status(401).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Cierra sesión
 */
export async function logout(req, res) {
  try {
    const userId = req.user?.userId;

    if (userId) {
      await authService.logout(userId);
      // Registrar cierre de sesión
      await logAction(userId, 'LOGOUT', 'Usuario cerró sesión');
    }

    res.json({
      success: true,
      message: 'Sesión cerrada correctamente'
    });
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Verifica el token actual
 */
export async function verifyToken(req, res) {
  try {
    // Si llegamos aquí, el middleware ya verificó el token
    res.json({
      success: true,
      data: {
        user: req.user
      }
    });
  } catch (error) {
    console.error('Error en verifyToken:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
