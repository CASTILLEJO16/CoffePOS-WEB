import crypto from 'crypto';
import License from '../models/License.js';
import Client from '../models/Client.js';
import Device from '../models/Device.js';

// Clave secreta para firmar licencias (debería estar en .env)
const SECRET_KEY = process.env.LICENSE_SECRET_KEY || 'coffee-pos-secret-key-2024';

class LicenseService {
  // Generar clave de licencia única
  generateLicenseKey() {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(8).toString('hex').toUpperCase();
    return `CP-${timestamp}-${random}`.toUpperCase();
  }

  // Generar firma digital
  generateSignature(licenseData) {
    const dataString = JSON.stringify(licenseData);
    const signature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(dataString)
      .digest('hex');
    return signature;
  }

  // Verificar firma digital
  verifySignature(licenseData, signature) {
    const dataString = JSON.stringify(licenseData);
    const expectedSignature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(dataString)
      .digest('hex');
    return expectedSignature === signature;
  }

  // Crear nueva licencia
  async createLicense(clientId, type, durationDays, maxDevices = 1) {
    try {
      const client = await Client.findById(clientId);
      if (!client) {
        throw new Error('Cliente no encontrado');
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + durationDays);

      const licenseKey = this.generateLicenseKey();

      const licenseData = {
        licenseKey,
        clientId: client._id.toString(),
        type,
        duration: durationDays,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        maxDevices
      };

      const signature = this.generateSignature(licenseData);

      const license = new License({
        client: clientId,
        licenseKey,
        type,
        duration: durationDays,
        startDate,
        endDate,
        maxDevices,
        signature
      });

      await license.save();
      return license;
    } catch (error) {
      throw new Error(`Error al crear licencia: ${error.message}`);
    }
  }

  // Extender licencia
  async extendLicense(licenseId, additionalDays) {
    try {
      const license = await License.findById(licenseId);
      if (!license) {
        throw new Error('Licencia no encontrada');
      }

      const newEndDate = new Date(license.endDate);
      newEndDate.setDate(newEndDate.getDate() + additionalDays);

      license.endDate = newEndDate;
      license.status = 'active';

      // Regenerar firma
      const licenseData = {
        licenseKey: license.licenseKey,
        clientId: license.client.toString(),
        type: license.type,
        duration: license.duration + additionalDays,
        startDate: license.startDate.toISOString(),
        endDate: newEndDate.toISOString(),
        maxDevices: license.maxDevices
      };

      license.signature = this.generateSignature(licenseData);
      await license.save();

      return license;
    } catch (error) {
      throw new Error(`Error al extender licencia: ${error.message}`);
    }
  }

  // Activar dispositivo
  async activateDevice(licenseKey, deviceId, deviceInfo) {
    try {
      const license = await License.findOne({ licenseKey });
      if (!license) {
        throw new Error('Licencia no encontrada');
      }

      // Verificar estado de bloqueo primero
      if (license.status === 'blocked') {
        throw new Error('Licencia bloqueada por el administrador');
      }

      // Verificar expiración - comparar fecha actual con endDate
      const currentDate = new Date();
      const expirationDate = new Date(license.endDate);

      if (currentDate > expirationDate) {
        // Actualizar estado a expirado si no lo está
        if (license.status !== 'expired') {
          license.status = 'expired';
          await license.save();
          console.log(`Licencia ${licenseKey} marcada como expirada al intentar activar dispositivo`);
        }
        throw new Error('Licencia expirada');
      }

      // Si estaba marcada como expirada pero la fecha aún es válida, reactivar
      if (license.status === 'expired' && currentDate <= expirationDate) {
        license.status = 'active';
        await license.save();
        console.log(`Licencia ${licenseKey} reactivada al activar dispositivo`);
      }

      // Buscar si el dispositivo ya existe por su ID único
      const existingDevice = await Device.findOne({ deviceId });

      if (existingDevice) {
        if (existingDevice.status === 'blocked') {
          throw new Error('Dispositivo bloqueado');
        }

        const isSameLicense = existingDevice.license.toString() === license._id.toString();

        if (!isSameLicense) {
          // Verificar límite de dispositivos para la nueva licencia
          if (license.devicesUsed >= license.maxDevices) {
            throw new Error('Límite de dispositivos alcanzado');
          }

          // Decrementar contador de la licencia previa
          const oldLicense = await License.findById(existingDevice.license);
          if (oldLicense && oldLicense.devicesUsed > 0) {
            oldLicense.devicesUsed -= 1;
            await oldLicense.save();
          }

          // Reasignar la nueva licencia
          existingDevice.license = license._id;
          license.devicesUsed += 1;
          await license.save();
        }

        // Actualizar información y estado del dispositivo
        existingDevice.deviceName = deviceInfo?.name || deviceInfo?.deviceName || existingDevice.deviceName;
        existingDevice.os = deviceInfo?.os || existingDevice.os;
        existingDevice.browser = deviceInfo?.browser || existingDevice.browser;
        existingDevice.ipAddress = deviceInfo?.ipAddress || existingDevice.ipAddress;
        existingDevice.status = 'active';
        existingDevice.lastUsed = new Date();
        await existingDevice.save();

        return { license, device: existingDevice };
      }

      // Si es un nuevo dispositivo, verificar límite de dispositivos
      if (license.devicesUsed >= license.maxDevices) {
        throw new Error('Límite de dispositivos alcanzado');
      }

      // Registrar nuevo dispositivo
      const device = new Device({
        license: license._id,
        deviceId,
        deviceName: deviceInfo?.name || deviceInfo?.deviceName || 'Unknown Device',
        os: deviceInfo?.os || 'Unknown',
        browser: deviceInfo?.browser || 'Unknown',
        ipAddress: deviceInfo?.ipAddress || 'Unknown',
        status: 'active'
      });

      await device.save();

      // Incrementar contador de dispositivos de la licencia
      license.devicesUsed += 1;
      await license.save();

      return { license, device };
    } catch (error) {
      throw new Error(`Error al activar dispositivo: ${error.message}`);
    }
  }

  // Bloquear dispositivo
  async blockDevice(deviceId) {
    try {
      const device = await Device.findOne({ deviceId });
      if (!device) {
        throw new Error('Dispositivo no encontrado');
      }

      device.status = 'blocked';
      await device.save();

      // Decrementar contador de dispositivos de la licencia
      const license = await License.findById(device.license);
      if (license && license.devicesUsed > 0) {
        license.devicesUsed -= 1;
        await license.save();
      }

      return device;
    } catch (error) {
      throw new Error(`Error al bloquear dispositivo: ${error.message}`);
    }
  }

  // Liberar dispositivo
  async releaseDevice(deviceId) {
    try {
      const device = await Device.findOne({ deviceId });
      if (!device) {
        throw new Error('Dispositivo no encontrado');
      }

      device.status = 'released';
      await device.save();

      // Decrementar contador de dispositivos de la licencia
      const license = await License.findById(device.license);
      if (license && license.devicesUsed > 0) {
        license.devicesUsed -= 1;
        await license.save();
      }

      return device;
    } catch (error) {
      throw new Error(`Error al liberar dispositivo: ${error.message}`);
    }
  }

  // Verificar licencia
  async verifyLicense(licenseKey, deviceId) {
    try {
      const license = await License.findOne({ licenseKey }).populate('client');
      if (!license) {
        return { valid: false, reason: 'Licencia no encontrada' };
      }

      // Verificar firma
      const licenseData = {
        licenseKey: license.licenseKey,
        clientId: license.client._id.toString(),
        type: license.type,
        duration: license.duration,
        startDate: license.startDate.toISOString(),
        endDate: license.endDate.toISOString(),
        maxDevices: license.maxDevices
      };

      if (!this.verifySignature(licenseData, license.signature)) {
        return { valid: false, reason: 'Firma inválida' };
      }

      // Verificar estado de bloqueo primero
      if (license.status === 'blocked') {
        return { valid: false, reason: 'Licencia bloqueada por el administrador' };
      }

      // Verificar expiración - comparar fecha actual con endDate
      const currentDate = new Date();
      const expirationDate = new Date(license.endDate);

      // Verificar si la licencia ha expirado
      if (currentDate > expirationDate) {
        // Actualizar estado a expirado si no lo está
        if (license.status !== 'expired') {
          license.status = 'expired';
          await license.save();
          console.log(`Licencia ${licenseKey} marcada como expirada el ${currentDate.toISOString()}`);
        }
        return { valid: false, reason: 'Licencia expirada' };
      }

      // Si estaba marcada como expirada pero la fecha aún es válida, reactivar
      if (license.status === 'expired' && currentDate <= expirationDate) {
        license.status = 'active';
        await license.save();
        console.log(`Licencia ${licenseKey} reactivada - estado corregido`);
      }

      // Verificar dispositivo
      const device = await Device.findOne({ deviceId, license: license._id });
      if (!device) {
        return { valid: false, reason: 'Dispositivo no registrado' };
      }

      if (device.status === 'blocked') {
        return { valid: false, reason: 'Dispositivo bloqueado' };
      }

      if (device.status === 'released') {
        return { valid: false, reason: 'Dispositivo liberado' };
      }

      return {
        valid: true,
        license,
        device,
        client: license.client
      };
    } catch (error) {
      throw new Error(`Error al verificar licencia: ${error.message}`);
    }
  }

  // Obtener dispositivos de una licencia
  async getLicenseDevices(licenseId) {
    try {
      const devices = await Device.find({ license: licenseId });
      return devices;
    } catch (error) {
      throw new Error(`Error al obtener dispositivos: ${error.message}`);
    }
  }

  // Bloquear licencia
  async blockLicense(licenseId) {
    try {
      const license = await License.findById(licenseId);
      if (!license) {
        throw new Error('Licencia no encontrada');
      }

      license.status = 'blocked';
      await license.save();

      // Bloquear todos los dispositivos
      await Device.updateMany({ license: licenseId }, { status: 'blocked' });

      return license;
    } catch (error) {
      throw new Error(`Error al bloquear licencia: ${error.message}`);
    }
  }

  // Activar licencia
  async activateLicense(licenseId) {
    try {
      const license = await License.findById(licenseId);
      if (!license) {
        throw new Error('Licencia no encontrada');
      }

      license.status = 'active';
      await license.save();

      // Activar dispositivos que no estén liberados
      await Device.updateMany(
        { license: licenseId, status: 'blocked' },
        { status: 'active' }
      );

      return license;
    } catch (error) {
      throw new Error(`Error al activar licencia: ${error.message}`);
    }
  }
}

export default new LicenseService();
