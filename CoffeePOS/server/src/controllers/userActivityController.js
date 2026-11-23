import { getUserById } from '../services/authService.js';
import { getSalesByUser } from '../services/saleService.js';
import { getCashRegistersByUser } from '../services/cashRegisterService.js';
import { getLogsByUser } from '../services/logService.js';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { belongsToRequester, isDeveloperRequest } from '../utils/tenant.js';

/**
 * Verifica que el usuario consultado pertenezca a la cafetería de quien consulta.
 * Responde 400/404 y retorna false si no procede.
 */
async function ensureScopedUser(req, res, userId) {
  if (!userId || userId === 'undefined' || !mongoose.Types.ObjectId.isValid(userId)) {
    res.status(400).json({ success: false, error: 'ID de usuario inválido' });
    return false;
  }
  const target = await User.findById(userId).select('clientId rol');
  if (!target || !belongsToRequester(req, target.clientId) || (target.rol === 'developer' && !isDeveloperRequest(req))) {
    res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    return false;
  }
  return true;
}

/**
 * Controlador de Actividad de Usuario
 * Maneja las requests para obtener el historial completo de un usuario
 */

export async function getUserActivity(req, res) {
  try {
    const { userId } = req.params;

    if (!(await ensureScopedUser(req, res, userId))) return;

    // Obtener información básica del usuario
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    // Obtener todas las actividades en paralelo
    const [cashRegisters, sales, logs] = await Promise.all([
      getCashRegistersByUser(userId),
      getSalesByUser(userId),
      getLogsByUser(userId)
    ]);

    // Calcular estadísticas
    const totalCajas = cashRegisters.length;
    const totalVentas = sales.length;
    const totalVentasMonto = sales.reduce((sum, sale) => sum + sale.total, 0);
    const totalLogs = logs.length;

    res.json({
      success: true,
      data: {
        user,
        statistics: {
          totalCajas,
          totalVentas,
          totalVentasMonto,
          totalLogs
        },
        cashRegisters,
        sales,
        logs
      }
    });
  } catch (error) {
    console.error('Error en getUserActivity:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getUserCashRegisters(req, res) {
  try {
    const { userId } = req.params;
    if (!(await ensureScopedUser(req, res, userId))) return;
    const cashRegisters = await getCashRegistersByUser(userId);

    res.json({
      success: true,
      data: cashRegisters
    });
  } catch (error) {
    console.error('Error en getUserCashRegisters:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getUserSales(req, res) {
  try {
    const { userId } = req.params;
    if (!(await ensureScopedUser(req, res, userId))) return;
    const sales = await getSalesByUser(userId);

    res.json({
      success: true,
      data: sales
    });
  } catch (error) {
    console.error('Error en getUserSales:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getUserLogs(req, res) {
  try {
    const { userId } = req.params;
    if (!(await ensureScopedUser(req, res, userId))) return;
    const logs = await getLogsByUser(userId);

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('Error en getUserLogs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
