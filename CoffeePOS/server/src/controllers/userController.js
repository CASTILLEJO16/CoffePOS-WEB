import mongoose from 'mongoose';
import * as authService from '../services/authService.js';
import { logAction } from '../services/logService.js';
import User from '../models/User.js';
import { belongsToRequester, isDeveloperRequest } from '../utils/tenant.js';

/**
 * Verifica que el usuario objetivo exista y pertenezca a la misma cafetería
 * que quien hace la petición. Las cuentas developer nunca son accesibles
 * desde un admin de cafetería.
 * Responde 404 (sin revelar si existe en otra cafetería) y retorna null si no procede.
 */
async function findScopedTargetUser(req, res, id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ success: false, error: 'ID de usuario inválido' });
    return null;
  }
  const target = await User.findById(id).select('clientId rol');
  const notAllowed = !target
    || !belongsToRequester(req, target.clientId)
    || (target.rol === 'developer' && !isDeveloperRequest(req));
  if (notAllowed) {
    res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    return null;
  }
  return target;
}

/**
 * Controlador de Usuarios
 * Maneja las requests HTTP relacionadas con usuarios
 */

/**
 * Obtiene todos los usuarios
 */
export async function getUsers(req, res) {
  try {
    const clientId = req.user?.clientId;
    const users = await authService.getUsers(clientId);

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error en getUsers:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Obtiene un usuario por ID
 */
export async function getUser(req, res) {
  try {
    const { id } = req.params;
    const target = await findScopedTargetUser(req, res, id);
    if (!target) return;
    const user = await authService.getUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error en getUser:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Crea un nuevo usuario
 */
export async function createUser(req, res) {
  try {
    const userData = req.body;
    const creatorId = req.user?.userId;
    const clientId = req.user?.clientId;

    const user = await authService.createUser(userData, creatorId, clientId);

    // Registrar creación de usuario
    await logAction(creatorId, 'CREAR_USUARIO', `Usuario creado: ${userData.nombre} (${userData.usuario})`);

    res.status(201).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error en createUser:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Actualiza un usuario existente
 */
export async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const userData = req.body;
    const updaterId = req.user?.userId;

    const target = await findScopedTargetUser(req, res, id);
    if (!target) return;

    const user = await authService.updateUser(id, userData, updaterId);

    // Registrar actualización de usuario
    await logAction(updaterId, 'ACTUALIZAR_USUARIO', `Usuario actualizado: ID ${id}`);

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error en updateUser:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Activa un usuario
 */
export async function activateUser(req, res) {
  try {
    const { id } = req.params;
    const updaterId = req.user?.userId;
    const target = await findScopedTargetUser(req, res, id);
    if (!target) return;
    const user = await authService.updateUser(id, { activo: true }, updaterId);
    res.json({ success: true, data: user, message: 'Usuario activado correctamente' });
  } catch (error) {
    console.error('Error en activateUser:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Desactiva un usuario
 */
export async function deactivateUser(req, res) {
  try {
    const { id } = req.params;
    const updaterId = req.user?.userId;
    const target = await findScopedTargetUser(req, res, id);
    if (!target) return;
    const user = await authService.updateUser(id, { activo: false }, updaterId);
    res.json({ success: true, data: user, message: 'Usuario desactivado correctamente' });
  } catch (error) {
    console.error('Error en deactivateUser:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

