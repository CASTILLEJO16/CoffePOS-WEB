import Log from '../models/Log.js';
import User from '../models/User.js';

/**
 * Servicio de Logs
 * Maneja el registro de actividades en el sistema
 */

/**
 * Registra una acción en el sistema
 * @param {string} usuarioId - ID del usuario (opcional)
 * @param {string} accion - Descripción de la acción
 * @param {string} detalles - Detalles adicionales (opcional)
 */
export async function logAction(usuarioId, accion, detalles = null, clientId = null) {
  try {
    // resolver clientId desde usuario si no se pasa
    if (!clientId && usuarioId) {
      try { const u = await User.findById(usuarioId); if (u) clientId = u.clientId; } catch {}
    }
    await Log.create({
      clientId,
      usuario_id: usuarioId,
      accion,
      detalles
    });
  } catch (error) {
    console.error('Error al registrar log:', error);
  }
}

/**
 * Obtiene el historial de logs
 * @param {number} limit - Límite de registros a retornar
 * @returns {Array} Lista de logs
 */
export async function getLogs(limit = 100, clientId = null) {
  try {
    const filter = {};
    if (clientId) filter.clientId = clientId;
    const logs = await Log.find(filter)
      .populate('usuario_id', 'nombre usuario')
      .sort({ createdAt: -1 })
      .limit(limit);
    return logs;
  } catch (error) {
    console.error('Error al obtener logs:', error);
    throw error;
  }
}

/**
 * Obtiene logs de un usuario específico
 * @param {string} usuarioId - ID del usuario
 * @returns {Array} Lista de logs del usuario
 */
export async function getLogsByUser(usuarioId, clientId = null) {
  try {
    const filter = { usuario_id: usuarioId };
    if (clientId) filter.clientId = clientId;
    const logs = await Log.find(filter)
      .sort({ createdAt: -1 });
    return logs;
  } catch (error) {
    console.error('Error al obtener logs del usuario:', error);
    throw error;
  }
}

/**
 * Obtiene logs con filtros avanzados
 * @param {Object} filters - Filtros de búsqueda
 * @returns {Array} Lista de logs filtrados
 */
export async function getLogsWithFilters(filters = {}) {
  try {
    const { accion, usuarioId, clientId, startDate, endDate, limit = 100 } = filters;
    
    const query = {};
    if (clientId) query.clientId = clientId;
    
    if (accion) {
      query.accion = accion;
    }

    if (usuarioId) {
      query.usuario_id = usuarioId;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    const logs = await Log.find(query)
      .populate('usuario_id', 'nombre usuario')
      .sort({ createdAt: -1 })
      .limit(limit);
    return logs;
  } catch (error) {
    console.error('Error al obtener logs con filtros:', error);
    throw error;
  }
}

/**
 * Obtiene el resumen de actividades por tipo
 * @returns {Object} Resumen de actividades
 */
export async function getActivitySummary(clientId = null) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const match = { createdAt: { $gte: today } };
    if (clientId) match.clientId = clientId;
    const summary = await Log.aggregate([
      {
        $match: match
      },
      {
        $group: {
          _id: '$accion',
          total: { $sum: 1 },
          fecha: { $first: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } }
        }
      }
    ]);
    return summary;
  } catch (error) {
    console.error('Error al obtener resumen de actividades:', error);
    throw error;
  }
}
