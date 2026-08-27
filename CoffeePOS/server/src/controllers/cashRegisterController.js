import * as cashRegisterService from '../services/cashRegisterService.js';
import { logAction } from '../services/logService.js';
import CashRegisterName from '../models/CashRegisterName.js';
import mongoose from 'mongoose';

/**
 * Controlador de Cajas
 * Maneja las requests HTTP relacionadas con cajas
 */

export async function getCashRegisterNames(req, res) {
  try {
    const nombres = await CashRegisterName.find({ activo: true });
    res.json({ success: true, data: nombres });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function createCashRegisterName(req, res) {
  try {
    const { nombre } = req.body;
    if (!nombre) throw new Error('El nombre es requerido');
    
    await CashRegisterName.create({ nombre });
    res.json({ success: true, message: 'Caja agregada correctamente' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Obtiene la caja abierta del usuario actual
 */
export async function getOpenCashRegister(req, res) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }

    const cashRegister = await cashRegisterService.getOpenCashRegisterByUser(userId);

    res.json({
      success: true,
      data: cashRegister
    });
  } catch (error) {
    console.error('Error en getOpenCashRegister:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Abre una nueva caja
 */
export async function openCashRegister(req, res) {
  try {
    const userId = req.user?.userId;
    const { nombre_caja, fondo_inicial, observaciones } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }

    // Verificar si el usuario ya tiene una caja abierta
    const existingOpen = await cashRegisterService.getOpenCashRegisterByUser(userId);
    if (existingOpen) {
      return res.status(400).json({
        success: false,
        error: 'El usuario ya tiene una caja abierta'
      });
    }

    const cashRegister = await cashRegisterService.openCashRegister({
      usuario_id: userId,
      nombre_caja,
      fondo_inicial: fondo_inicial || 0,
      observaciones
    });

    // Registrar apertura en log
    await logAction(userId, 'APERTURA_CAJA', `Caja abierta: ${nombre_caja} - Fondo inicial: ${fondo_inicial}`);

    res.status(201).json({
      success: true,
      data: cashRegister
    });
  } catch (error) {
    console.error('Error en openCashRegister:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Cierra una caja
 */
export async function closeCashRegister(req, res) {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { total_contado, observaciones } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID de caja inválido'
      });
    }

    // Obtener la caja
    const cashRegister = await cashRegisterService.getCashRegisterById(id);
    if (!cashRegister) {
      return res.status(404).json({
        success: false,
        error: 'Caja no encontrada'
      });
    }

    // Verificar que la caja pertenezca al usuario o que sea admin
    if (req.user?.role !== 'admin' && cashRegister.usuario_id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para cerrar esta caja'
      });
    }

    // Verificar que la caja esté abierta
    if (cashRegister.estado !== 'abierta') {
      return res.status(400).json({
        success: false,
        error: 'La caja ya está cerrada'
      });
    }

    // Calcular totales de ventas
    const salesSummary = await cashRegisterService.getSalesSummaryByCashRegister(id);

    // Calcular total esperado (incluyendo descuentos)
    const total_esperado = cashRegister.fondo_inicial + salesSummary.ventas_efectivo - salesSummary.total_descuentos - salesSummary.total_devoluciones;

    // Calcular diferencia
    const diferencia = total_contado - total_esperado;

    // Cerrar la caja
    const closedCashRegister = await cashRegisterService.closeCashRegister(id, {
      total_contado,
      total_esperado,
      diferencia,
      observaciones: observaciones || cashRegister.observaciones,
      ...salesSummary
    });

    // Registrar cierre en log
    await logAction(userId, 'CIERRE_CAJA', `Caja cerrada - Diferencia: ${diferencia}`);

    res.json({
      success: true,
      data: closedCashRegister
    });
  } catch (error) {
    console.error('Error en closeCashRegister:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Obtiene el resumen de una caja antes de cerrarla
 */
export async function getCashRegisterSummary(req, res) {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID de caja inválido'
      });
    }

    const cashRegister = await cashRegisterService.getCashRegisterById(id);
    if (!cashRegister) {
      return res.status(404).json({
        success: false,
        error: 'Caja no encontrada'
      });
    }

    // Verificar que la caja pertenezca al usuario o que sea admin
    if (req.user?.role !== 'admin' && cashRegister.usuario_id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para ver esta caja'
      });
    }

    // Obtener resumen de ventas
    const salesSummary = await cashRegisterService.getSalesSummaryByCashRegister(id);

    // Calcular total esperado (incluyendo descuentos y devoluciones)
    // ventas_dolar ya está incluido en ventas_efectivo
    const fondoInicial = cashRegister.fondo_inicial || 0;
    const total_esperado = fondoInicial + (salesSummary.ventas_efectivo || 0) - (salesSummary.total_descuentos || 0) - (salesSummary.total_devoluciones || 0);

    res.json({
      success: true,
      data: {
        ...cashRegister.toObject(),
        usuario_nombre: cashRegister.usuario_id?.nombre || 'Desconocido',
        nombre_caja: cashRegister.nombre_caja || 'Sin nombre',
        fondo_inicial: fondoInicial,
        ...salesSummary,
        total_esperado
      }
    });
  } catch (error) {
    console.error('Error en getCashRegisterSummary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Obtiene todas las cajas (para administradores)
 */
export async function getAllCashRegisters(req, res) {
  try {
    const { startDate, endDate, estado, usuario_id } = req.query;

    const cashRegisters = await cashRegisterService.getAllCashRegisters({
      startDate,
      endDate,
      estado,
      usuario_id
    });

    // Enriquecer los datos con nombres legibles
    const enrichedCashRegisters = cashRegisters.map(cr => ({
      ...cr.toObject(),
      usuario_nombre: cr.usuario_id?.nombre || 'Desconocido',
      nombre_caja: cr.nombre_caja || 'Sin nombre'
    }));

    res.json({
      success: true,
      data: enrichedCashRegisters
    });
  } catch (error) {
    console.error('Error en getAllCashRegisters:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Obtiene una caja por ID
 */
export async function getCashRegister(req, res) {
  try {
    const { id } = req.params;

    const cashRegister = await cashRegisterService.getCashRegisterById(id);

    if (!cashRegister) {
      return res.status(404).json({
        success: false,
        error: 'Caja no encontrada'
      });
    }

    res.json({
      success: true,
      data: cashRegister
    });
  } catch (error) {
    console.error('Error en getCashRegister:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
