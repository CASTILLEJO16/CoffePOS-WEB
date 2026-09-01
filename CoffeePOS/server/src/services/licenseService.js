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
  async createLicense(clientId, type, durationDays, maxDevices = 1, maxUsers = 3) {
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
        maxDevices,
        maxUsers
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
        maxUsers,
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
        maxDevices: license.maxDevices,
        maxUsers: license.maxUsers || 3
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

      // Verificar firma - compatible con licencias legacy sin maxUsers
      const licenseData = {
        licenseKey: license.licenseKey,
        clientId: license.client._id.toString(),
        type: license.type,
        duration: license.duration,
        startDate: license.startDate.toISOString(),
        endDate: license.endDate.toISOString(),
        maxDevices: license.maxDevices,
        maxUsers: license.maxUsers || 3
      };
      // Fallback para firma legacy sin maxUsers
      const legacyData = {
        licenseKey: license.licenseKey,
        clientId: license.client._id.toString(),
        type: license.type,
        duration: license.duration,
        startDate: license.startDate.toISOString(),
        endDate: license.endDate.toISOString(),
        maxDevices: license.maxDevices
      };

      if (!this.verifySignature(licenseData, license.signature) && !this.verifySignature(legacyData, license.signature)) {
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

  // Actualizar licencia (editar días, dispositivos, usuarios)
  async updateLicense(licenseId, updates) {
    try {
      const license = await License.findById(licenseId);
      if (!license) {
        throw new Error('Licencia no encontrada');
      }

      let needsSignature = false;

      if (updates.maxDevices !== undefined) {
        const val = parseInt(updates.maxDevices);
        if (isNaN(val) || val < 1) throw new Error('maxDevices debe ser >=1');
        license.maxDevices = val;
        needsSignature = true;
      }
      if (updates.maxUsers !== undefined) {
        const val = parseInt(updates.maxUsers);
        if (isNaN(val) || val < 1) throw new Error('maxUsers debe ser >=1');
        license.maxUsers = val;
        needsSignature = true;
      }
      if (updates.type !== undefined) {
        if (!['trial','subscription','lifetime'].includes(updates.type)) throw new Error('Tipo inválido');
        license.type = updates.type;
        needsSignature = true;
      }
      if (updates.durationDays !== undefined) {
        const val = parseInt(updates.durationDays);
        if (isNaN(val) || val < 1) throw new Error('durationDays debe ser >=1');
        // recalcular endDate basado en startDate o endDate actual
        const base = new Date(license.startDate);
        const newEnd = new Date(base);
        newEnd.setDate(newEnd.getDate() + val);
        license.duration = val;
        license.endDate = newEnd;
        needsSignature = true;
      }
      if (updates.endDate !== undefined) {
        const newEnd = new Date(updates.endDate);
        if (isNaN(newEnd.getTime())) throw new Error('endDate inválida');
        license.endDate = newEnd;
        // recalcular duration
        const diff = Math.ceil((newEnd - new Date(license.startDate)) / (1000*60*60*24));
        license.duration = diff > 0 ? diff : license.duration;
        needsSignature = true;
      }
      if (updates.status !== undefined) {
        license.status = updates.status;
      }

      // Si se extendió o cambió fecha, reactivar si estaba expirada y ahora es válida
      const now = new Date();
      if (license.endDate > now && license.status === 'expired') {
        license.status = 'active';
      }

      if (needsSignature) {
        const licenseData = {
          licenseKey: license.licenseKey,
          clientId: license.client.toString(),
          type: license.type,
          duration: license.duration,
          startDate: license.startDate.toISOString(),
          endDate: license.endDate.toISOString(),
          maxDevices: license.maxDevices,
          maxUsers: license.maxUsers || 3
        };
        license.signature = this.generateSignature(licenseData);
      }

      await license.save();
      return license;
    } catch (error) {
      throw new Error(`Error al actualizar licencia: ${error.message}`);
    }
  }

  // Verificar licencia por clientId (para middleware de auth)
  async verifyClientLicense(clientId) {
    try {
      const licenses = await License.find({ client: clientId }).sort({ endDate: -1 });
      if (!licenses || licenses.length === 0) {
        return { valid: false, reason: 'Sin licencia asignada. Contacta al administrador.' };
      }
      // Buscar licencia activa no expirada, o la más reciente
      const now = new Date();
      for (const lic of licenses) {
        const end = new Date(lic.endDate);
        if (lic.status === 'blocked') {
          return { valid: false, reason: 'Licencia bloqueada por el administrador' };
        }
        if (now > end) {
          if (lic.status !== 'expired') {
            lic.status = 'expired';
            await lic.save();
          }
          continue; // probar siguiente licencia
        }
        if (lic.status === 'expired' && now <= end) {
          lic.status = 'active';
          await lic.save();
        }
        // verificar firma
        const licenseData = {
          licenseKey: lic.licenseKey,
          clientId: lic.client.toString(),
          type: lic.type,
          duration: lic.duration,
          startDate: lic.startDate.toISOString(),
          endDate: lic.endDate.toISOString(),
          maxDevices: lic.maxDevices,
          maxUsers: lic.maxUsers || 3
        };
        const legacyData = {
          licenseKey: lic.licenseKey,
          clientId: lic.client.toString(),
          type: lic.type,
          duration: lic.duration,
          startDate: lic.startDate.toISOString(),
          endDate: lic.endDate.toISOString(),
          maxDevices: lic.maxDevices
        };
        if (!this.verifySignature(licenseData, lic.signature) && !this.verifySignature(legacyData, lic.signature)) {
          continue;
        }
        return { valid: true, license: lic };
      }
      return { valid: false, reason: 'Licencia expirada' };
    } catch (error) {
      throw new Error(`Error al verificar licencia del cliente: ${error.message}`);
    }
  }
}

export default new LicenseService();
