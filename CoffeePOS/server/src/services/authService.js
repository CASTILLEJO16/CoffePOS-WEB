import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';
import { logAction } from './logService.js';

/**
 * Servicio de Autenticación
 * Maneja la lógica de autenticación y autorización
 */

/**
 * Autentica un usuario con usuario y contraseña
 * @param {string} username - Nombre de usuario
 * @param {string} password - Contraseña
 * @returns {Object} Token y datos del usuario
 */
export async function login(username, password) {
  try {
    const normalizedUsername = String(username).toLowerCase();
    // Buscar usuario por nombre de usuario (sin clientId para login global)
    const user = await User.findOne({ 
      usuario: normalizedUsername, 
      activo: true 
    });

    if (!user) {
      throw new Error('Credenciales inválidas');
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.contraseña_hash);

    if (!isValidPassword) {
      throw new Error('Credenciales inválidas');
    }

    // Generar token JWT
    const token = jwt.sign(
      {
        userId: user._id,
        username: user.usuario,
        role: user.rol,
        clientId: user.clientId
      },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    // Registrar login
    await logAction(user._id, 'LOGIN', 'Usuario inició sesión');

    // Retornar datos sin contraseña
    const userWithoutPassword = user.toJSON();

    return {
      token,
      user: userWithoutPassword
    };
  } catch (error) {
    console.error('Error en login:', error.message);
    throw error;
  }
}

/**
 * Autentica un usuario con PIN de 4 dígitos - SCOPED POR CAFETERÍA
 * @param {string} pin - Código de 4 dígitos
 * @param {string} clientId - ID de la cafetería (obligatorio para multi-tenant)
 * @returns {Object} Token y datos del usuario
 */
export async function loginWithPin(pin, clientId = null) {
  try {
    const cleanPin = String(pin).trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      throw new Error('PIN debe ser 4 dígitos numéricos');
    }

    if (!clientId) {
      throw new Error('No se pudo identificar la cafetería. Activa la licencia del dispositivo.');
    }

    const user = await User.findOne({
      pin: cleanPin,
      clientId,
      activo: true
    });

    if (!user) {
      throw new Error('PIN inválido');
    }

    const token = jwt.sign(
      {
        userId: user._id,
        username: user.usuario,
        role: user.rol,
        clientId: user.clientId
      },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    await logAction(user._id, 'LOGIN_PIN', 'Usuario inició sesión con PIN');

    return {
      token,
      user: user.toJSON()
    };
  } catch (error) {
    console.error('Error en loginWithPin:', error.message);
    throw error;
  }
}

/**
 * Verifica un token JWT
 * @param {string} token - Token JWT
 * @returns {Object} Datos decodificados del token
 */
export function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    return decoded;
  } catch (error) {
    console.error('Error al verificar token:', error);
    throw new Error('Token inválido o expirado');
  }
}

/**
 * Registra el logout de un usuario
 * @param {number} userId - ID del usuario
 */
export async function logout(userId) {
  try {
    await logAction(userId, 'LOGOUT', 'Usuario cerró sesión');
  } catch (error) {
    console.error('Error al registrar logout:', error);
    throw error;
  }
}

/**
 * Crea un nuevo usuario
 * @param {Object} userData - Datos del usuario
 * @param {string} creatorId - ID del usuario que crea
 * @returns {Object} Usuario creado
 */
export async function createUser(userData, creatorId = null, clientId = null) {
  try {
    let { nombre, usuario, contraseña, rol = 'cajero', pin } = userData;
    usuario = String(usuario).toLowerCase();

    const allowedRoles = ['admin', 'cajero'];
    if (!allowedRoles.includes(rol)) {
      throw new Error('Rol inválido');
    }

    // Verificar si el usuario ya existe (considerando clientId)
    const filter = { usuario };
    if (clientId) {
      filter.clientId = clientId;
    }
    const existingUser = await User.findOne(filter);

    if (existingUser) {
      throw new Error('El nombre de usuario ya existe en esta cafetería');
    }

    // Verificar límite de usuarios permitidos por licencia
    if (clientId) {
      try {
        const License = (await import('../models/License.js')).default;
        const licenses = await License.find({ client: clientId });
        let maxUsers = 3;
        let hasValidLicense = false;
        const now = new Date();
        for (const lic of licenses) {
          if (lic.status !== 'blocked' && new Date(lic.endDate) > now) {
            hasValidLicense = true;
            if (lic.maxUsers) maxUsers = Math.max(maxUsers, lic.maxUsers);
          }
        }
        // Si hay licencia válida, aplicar límite
        if (hasValidLicense) {
          const currentCount = await User.countDocuments({ clientId });
          if (currentCount >= maxUsers) {
            throw new Error(`Límite de usuarios alcanzado (${maxUsers} permitidos). Actualiza la licencia para agregar más cuentas.`);
          }
        }
      } catch (e) {
        if (e.message.includes('Límite de usuarios')) throw e;
        console.warn('[createUser] No se pudo verificar límite de usuarios:', e.message);
      }
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(contraseña, 10);

    // Validar y preparar PIN si se proporciona - scoped por cafetería
    let pinToSave = undefined;
    if (pin !== undefined && pin !== null && String(pin).trim() !== '') {
      const cleanPin = String(pin).trim();
      if (!/^\d{4}$/.test(cleanPin)) {
        throw new Error('PIN debe ser 4 dígitos numéricos');
      }
      const pinFilter = { pin: cleanPin };
      if (clientId) pinFilter.clientId = clientId;
      const existingPin = await User.findOne(pinFilter);
      if (existingPin) {
        throw new Error('El PIN ya está en uso por otro usuario de esta cafetería');
      }
      pinToSave = cleanPin;
    }

    // Crear usuario
    const newUser = await User.create({
      clientId,
      nombre,
      usuario,
      contraseña_hash: hashedPassword,
      rol,
      ...(pinToSave ? { pin: pinToSave } : {})
    });

    // Registrar acción
    await logAction(creatorId, 'CREAR_USUARIO', `Usuario creado: ${usuario}`);

    // Retornar usuario sin contraseña
    return newUser.toJSON();
  } catch (error) {
    console.error('Error al crear usuario:', error.message);
    throw error;
  }
}

/**
 * Actualiza un usuario existente
 * @param {string} id - ID del usuario
 * @param {Object} userData - Datos a actualizar
 * @param {string} updaterId - ID del usuario que actualiza
 * @returns {Object} Usuario actualizado
 */
export async function updateUser(id, userData, updaterId = null) {
  try {
    let { nombre, usuario, contraseña, rol, activo, pin } = userData;

    const updates = {};

    if (nombre !== undefined) {
      updates.nombre = nombre;
    }

    if (usuario !== undefined) {
      const normalized = String(usuario).toLowerCase();
      // verificar duplicado
      const existing = await User.findOne({ 
        usuario: normalized, 
        _id: { $ne: id } 
      });
      if (existing) {
        throw new Error('El nombre de usuario ya existe');
      }
      updates.usuario = normalized;
    }

    if (contraseña !== undefined) {
      updates.contraseña_hash = await bcrypt.hash(contraseña, 10);
    }

    if (rol !== undefined) {
      updates.rol = rol;
    }

    if (activo !== undefined) {
      updates.activo = activo;
    }

    if (pin !== undefined) {
      const cleanPin = pin === null ? '' : String(pin).trim();
      if (cleanPin === '') {
        // limpiar PIN
        updates.pin = null;
      } else {
        if (!/^\d{4}$/.test(cleanPin)) {
          throw new Error('PIN debe ser 4 dígitos numéricos');
        }
        // Necesitamos el clientId del usuario para scoped uniqueness
        const targetUser = await User.findById(id).select('clientId');
        if (!targetUser) {
          throw new Error('Usuario no encontrado');
        }
        const pinFilter = { pin: cleanPin, clientId: targetUser.clientId, _id: { $ne: id } };
        const existingPin = await User.findOne(pinFilter);
        if (existingPin) {
          throw new Error('El PIN ya está en uso por otro usuario de esta cafetería');
        }
        updates.pin = cleanPin;
      }
    }

    if (Object.keys(updates).length === 0) {
      throw new Error('No hay datos para actualizar');
    }

    // Manejar limpieza de PIN (null) con $unset para sparse index
    let updatedUser;
    if (updates.pin === null) {
      const { pin: _p, ...rest } = updates;
      updatedUser = await User.findByIdAndUpdate(id, { $set: rest, $unset: { pin: 1 } }, { new: true });
    } else {
      updatedUser = await User.findByIdAndUpdate(id, updates, { new: true });
    }

    // Registrar acción
    await logAction(updaterId, 'ACTUALIZAR_USUARIO', `Usuario actualizado: ${usuario}`);

    return updatedUser.toJSON();
  } catch (error) {
    console.error('Error al actualizar usuario:', error.message);
    throw error;
  }
}

/**
 * Obtiene todos los usuarios
 * @returns {Array} Lista de usuarios
 */
export async function getUsers(clientId = null) {
  try {
    const filter = {};
    if (clientId) {
      filter.clientId = clientId;
    }
    const users = await User.find(filter).sort({ nombre: 1 });
    return users.map(user => user.toJSON());
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    throw error;
  }
}

/**
 * Obtiene un usuario por su ID
 * @param {string} id - ID del usuario
 * @returns {Object} Usuario encontrado
 */
export async function getUserById(id) {
  try {
    const user = await User.findById(id);
    return user ? user.toJSON() : null;
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    throw error;
  }
}

/**
 * Verifica la contraseña de un usuario
 * @param {string} userId - ID del usuario
 * @param {string} password - Contraseña a verificar
 * @returns {boolean} Si la contraseña es correcta
 */
export async function verifyUserPassword(userId, password) {
  try {
    const user = await User.findOne({ 
      _id: userId, 
      activo: true 
    });

    if (!user) {
      return false;
    }

    const isValidPassword = await bcrypt.compare(password, user.contraseña_hash);
    return isValidPassword;
  } catch (error) {
    console.error('Error al verificar contraseña:', error);
    return false;
  }
}

/**
 * Verifica la contraseña del usuario admin
 * @param {string} password - Contraseña a verificar
 * @param {string} clientId - ID del cliente para buscar admin de esa cafetería
 * @returns {boolean} Si la contraseña es correcta
 */
export async function verifyAdminPassword(password, clientId = null) {
  try {
    // Buscar usuario admin del mismo cliente, si no existe fallback global
    let adminUser = null;
    if (clientId) {
      adminUser = await User.findOne({ 
        clientId,
        rol: 'admin',
        activo: true 
      });
      // Si no hay admin para ese cliente, probar con usuario 'admin' específico del cliente
      if (!adminUser) {
        adminUser = await User.findOne({ 
          usuario: 'admin', 
          clientId,
          rol: 'admin',
          activo: true 
        });
      }
      // Si aún no, comparar contra cualquier admin del cliente con verificación de contraseña
      if (!adminUser) {
        const admins = await User.find({ clientId, rol: 'admin', activo: true });
        for (const u of admins) {
          if (await bcrypt.compare(password, u.contraseña_hash)) return true;
        }
        return false;
      }
    } else {
      adminUser = await User.findOne({ 
        usuario: 'admin', 
        rol: 'admin',
        activo: true 
      });
    }

    if (!adminUser) {
      return false;
    }

    const isValidPassword = await bcrypt.compare(password, adminUser.contraseña_hash);
    // Si falla y es búsqueda global, intentar con cualquier admin del sistema
    if (!isValidPassword && !clientId) {
      const admins = await User.find({ rol: 'admin', activo: true });
      for (const u of admins) {
        if (await bcrypt.compare(password, u.contraseña_hash)) return true;
      }
    }
    return isValidPassword;
  } catch (error) {
    console.error('Error al verificar contraseña de admin:', error);
    return false;
  }
}
