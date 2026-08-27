import licenseService from '../services/licenseService.js';

// Middleware para verificar licencia del cliente
export const verifyLicenseMiddleware = async (req, res, next) => {
  try {
    const licenseKey = req.headers['x-license-key'];
    const deviceId = req.headers['x-device-id'];

    if (!licenseKey || !deviceId) {
      return res.status(401).json({
        success: false,
        message: 'Se requiere licencia y dispositivo'
      });
    }

    const result = await licenseService.verifyLicense(licenseKey, deviceId);

    if (!result.valid) {
      return res.status(403).json({
        success: false,
        message: result.reason,
        licenseValid: false
      });
    }

    // Agregar información de licencia al request
    req.license = result.license;
    req.device = result.device;
    req.client = result.client;

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al verificar licencia',
      error: error.message
    });
  }
};

// Middleware opcional para verificar licencia (no bloquea si no hay licencia)
export const optionalLicenseMiddleware = async (req, res, next) => {
  try {
    const licenseKey = req.headers['x-license-key'];
    const deviceId = req.headers['x-device-id'];

    if (!licenseKey || !deviceId) {
      // Si no hay licencia, continuar sin verificar
      req.license = null;
      req.device = null;
      req.client = null;
      return next();
    }

    const result = await licenseService.verifyLicense(licenseKey, deviceId);

    if (result.valid) {
      req.license = result.license;
      req.device = result.device;
      req.client = result.client;
    } else {
      req.license = null;
      req.device = null;
      req.client = null;
    }

    next();
  } catch (error) {
    // En caso de error, continuar sin verificar
    req.license = null;
    req.device = null;
    req.client = null;
    next();
  }
};

// Middleware para verificar si es administrador (no requiere licencia)
export const adminOnlyMiddleware = (req, res, next) => {
  // Los administradores no necesitan licencia
  // Este middleware se usa después del authMiddleware
  if (req.user && req.user.role === 'admin') {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Acceso denegado. Solo administradores.'
  });
};
