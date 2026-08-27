import License from '../models/License.js';
import Client from '../models/Client.js';
import Device from '../models/Device.js';
import licenseService from '../services/licenseService.js';

// Generar licencia
export const generateLicense = async (req, res) => {
  try {
    const { clientId, type, durationDays, maxDevices } = req.body;

    const license = await licenseService.createLicense(
      clientId,
      type,
      durationDays,
      maxDevices
    );

    res.status(201).json({
      success: true,
      message: 'Licencia generada exitosamente',
      data: license
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al generar licencia',
      error: error.message
    });
  }
};

// Obtener todas las licencias
export const getLicenses = async (req, res) => {
  try {
    const licenses = await License.find()
      .populate('client')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: licenses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener licencias',
      error: error.message
    });
  }
};

// Obtener licencia por ID
export const getLicenseById = async (req, res) => {
  try {
    const license = await License.findById(req.params.id)
      .populate('client');

    if (!license) {
      return res.status(404).json({
        success: false,
        message: 'Licencia no encontrada'
      });
    }

    res.status(200).json({
      success: true,
      data: license
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener licencia',
      error: error.message
    });
  }
};

// Extender licencia
export const extendLicense = async (req, res) => {
  try {
    const { licenseId, additionalDays } = req.body;

    const license = await licenseService.extendLicense(licenseId, additionalDays);

    res.status(200).json({
      success: true,
      message: 'Licencia extendida exitosamente',
      data: license
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al extender licencia',
      error: error.message
    });
  }
};

// Bloquear licencia
export const blockLicense = async (req, res) => {
  try {
    const license = await licenseService.blockLicense(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Licencia bloqueada exitosamente',
      data: license
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al bloquear licencia',
      error: error.message
    });
  }
};

// Activar licencia
export const activateLicense = async (req, res) => {
  try {
    const license = await licenseService.activateLicense(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Licencia activada exitosamente',
      data: license
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al activar licencia',
      error: error.message
    });
  }
};

// Obtener dispositivos de una licencia
export const getLicenseDevices = async (req, res) => {
  try {
    const devices = await licenseService.getLicenseDevices(req.params.id);

    res.status(200).json({
      success: true,
      data: devices
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener dispositivos',
      error: error.message
    });
  }
};

// Bloquear dispositivo
export const blockDevice = async (req, res) => {
  try {
    const { deviceId } = req.body;

    const device = await licenseService.blockDevice(deviceId);

    res.status(200).json({
      success: true,
      message: 'Dispositivo bloqueado exitosamente',
      data: device
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al bloquear dispositivo',
      error: error.message
    });
  }
};

// Liberar dispositivo
export const releaseDevice = async (req, res) => {
  try {
    const { deviceId } = req.body;

    const device = await licenseService.releaseDevice(deviceId);

    res.status(200).json({
      success: true,
      message: 'Dispositivo liberado exitosamente',
      data: device
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al liberar dispositivo',
      error: error.message
    });
  }
};

// Verificar licencia (para el cliente)
export const verifyLicense = async (req, res) => {
  try {
    const { licenseKey, deviceId } = req.body;

    if (!licenseKey || !deviceId) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Clave de licencia e ID de dispositivo son requeridos'
      });
    }

    const result = await licenseService.verifyLicense(licenseKey, deviceId);

    res.status(200).json({
      success: true,
      valid: result.valid,
      message: result.reason || 'Verificación completada',
      ...result
    });
  } catch (error) {
    const cleanMessage = error.message.replace(/^Error al [^:]+:\s*/, '');
    res.status(500).json({
      success: false,
      valid: false,
      message: cleanMessage || 'Error al verificar licencia',
      error: error.message
    });
  }
};

// Activar dispositivo (para el cliente)
export const activateDevice = async (req, res) => {
  try {
    const { licenseKey, deviceId, deviceInfo } = req.body;

    if (!licenseKey || !deviceId) {
      return res.status(400).json({
        success: false,
        message: 'La clave de licencia y el ID del dispositivo son requeridos'
      });
    }

    const result = await licenseService.activateDevice(licenseKey, deviceId, deviceInfo);

    res.status(200).json({
      success: true,
      message: 'Dispositivo activado exitosamente',
      data: result
    });
  } catch (error) {
    const cleanMessage = error.message.replace(/^Error al [^:]+:\s*/, '');
    const isClientError = cleanMessage.includes('Licencia') || 
                          cleanMessage.includes('Límite') || 
                          cleanMessage.includes('Dispositivo') ||
                          cleanMessage.includes('requeridos');
    const statusCode = isClientError ? 400 : 500;

    res.status(statusCode).json({
      success: false,
      message: cleanMessage || 'Error al activar dispositivo',
      error: cleanMessage
    });
  }
};
