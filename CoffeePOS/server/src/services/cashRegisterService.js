import mongoose from 'mongoose';
import CashRegister from '../models/CashRegister.js';
import User from '../models/User.js';
import Sale from '../models/Sale.js';
import SaleDetail from '../models/SaleDetail.js';

/**
 * Servicio de Cajas
 * Contiene toda la lógica de negocio relacionada con cajas
 */

/**
 * Obtiene la caja abierta de un usuario
 * @param {string} usuarioId - ID del usuario
 * @returns {Object|null} Caja abierta o null
 */
export async function getOpenCashRegisterByUser(usuarioId) {
  try {
    const cashRegister = await CashRegister.findOne({ 
      usuario_id: usuarioId, 
      estado: 'abierta' 
    })
    .populate('usuario_id', 'nombre')
    .sort({ fecha_apertura: -1 })
    .limit(1);

    return cashRegister;
  } catch (error) {
    console.error('Error al obtener caja abierta:', error);
    throw error;
  }
}

/**
 * Obtiene una caja por su ID
 * @param {string} id - ID de la caja
 * @returns {Object|null} Caja o null
 */
export async function getCashRegisterById(id) {
  try {
    const cashRegister = await CashRegister.findById(id)
      .populate('usuario_id', 'nombre');
    return cashRegister;
  } catch (error) {
    console.error('Error al obtener caja:', error);
    throw error;
  }
}

/**
 * Abre una nueva caja
 * @param {Object} data - Datos de la caja
 * @returns {Object} Caja creada
 */
export async function openCashRegister(data) {
  try {
    const { usuario_id, nombre_caja, fondo_inicial, observaciones, clientId } = data;
    const fecha_apertura = new Date();

    if (!clientId) {
      throw new Error('clientId es requerido para abrir caja. Vuelve a iniciar sesión.');
    }

    const existing = await getOpenCashRegisterByUser(usuario_id);
    if (existing) {
      throw new Error('Ya hay una caja abierta para este usuario');
    }

    // Evitar que la misma caja (por nombre) sea usada por otro usuario
    if (nombre_caja) {
      const cajaEnUso = await CashRegister.findOne({ 
        nombre_caja, 
        estado: 'abierta' 
      }).limit(1);

      if (cajaEnUso) {
        throw new Error('Esta caja ya está en uso por otro usuario');
      }
    }

    const newCashRegister = await CashRegister.create({
      clientId,
      usuario_id,
      nombre_caja,
      fondo_inicial,
      observaciones,
      estado: 'abierta',
      fecha_apertura
    });

    return await getCashRegisterById(newCashRegister._id);
  } catch (error) {
    console.error('Error al abrir caja:', error);
    throw error;
  }
}

/**
 * Cierra una caja
 * @param {string} id - ID de la caja
 * @param {Object} data - Datos del cierre
 * @returns {Object} Caja cerrada
 */
export async function closeCashRegister(id, data) {
  try {
    const { total_contado, observaciones } = data;

    const caja = await getCashRegisterById(id);
    if (!caja) throw new Error('Caja no encontrada');
    if (caja.estado !== 'abierta') throw new Error('La caja ya está cerrada');

    const sales = await Sale.aggregate([
      { $match: { caja_id: caja._id, cancelada: { $ne: true } } },
      { $group: { 
        _id: '$metodo_pago', 
        total: { $sum: '$total' },
        monto_dolar: { $sum: '$monto_dolar' }
      }}
    ]);

    let ventas_efectivo = 0;
    let ventas_tarjeta = 0;
    let ventas_transferencia = 0;
    let ventas_otros = 0;
    let ventas_dolar = 0;
    let total_dolar = 0;

    sales.forEach(sale => {
      const metodo = sale._id?.toLowerCase();
      switch (metodo) {
        case 'efectivo': ventas_efectivo = sale.total || 0; break;
        case 'tarjeta':
        case 'credito':
        case 'debito': ventas_tarjeta = sale.total || 0; break;
        case 'transferencia': ventas_transferencia = sale.total || 0; break;
        case 'dolar':
          ventas_dolar = sale.total || 0;
          total_dolar = sale.monto_dolar || 0;
          break;
        default: ventas_otros += sale.total || 0;
      }
    });

    // Calcular total de descuentos desde los detalles de ventas
    const discountDetails = await SaleDetail.aggregate([
      { $lookup: { from: 'sales', localField: 'venta_id', foreignField: '_id', as: 'venta' }},
      { $match: { 
        'venta.caja_id': caja._id,
        'venta.cancelada': { $ne: true },
        descuento: { $gt: 0 }
      }},
      { $project: { precio: 1, cantidad: 1, descuento: 1 }}
    ]);

    let total_descuentos = 0;
    discountDetails.forEach(detail => {
      const discountAmount = detail.precio * (detail.descuento / 100) * detail.cantidad;
      total_descuentos += discountAmount;
    });
    total_descuentos = Number(total_descuentos.toFixed(2));

    const total_devoluciones = caja.total_devoluciones || 0;

    const total_esperado =
      ventas_efectivo + ventas_tarjeta + ventas_transferencia + ventas_otros + ventas_dolar;

    const diferencia = Number((total_contado - total_esperado).toFixed(2));

    const fecha_cierre = new Date();

    const updatedCashRegister = await CashRegister.findByIdAndUpdate(id, {
      fecha_cierre,
      ventas_efectivo,
      ventas_tarjeta,
      ventas_transferencia,
      ventas_otros,
      ventas_dolar,
      total_dolar,
      total_descuentos,
      total_devoluciones,
      total_esperado,
      total_contado,
      diferencia,
      observaciones,
      estado: 'cerrada'
    }, { new: true });

    return updatedCashRegister;
  } catch (error) {
    console.error('Error al cerrar caja:', error.message);
    throw error;
  }
}

/**
 * Obtiene el resumen de ventas de una caja
 * @param {string} cajaId - ID de la caja
 * @returns {Object} Resumen de ventas
 */
export async function getSalesSummaryByCashRegister(cajaId) {
  try {
    // Obtener ventas por método de pago (excluyendo devueltas)
    const salesByMethod = await Sale.aggregate([
      { $match: { 
        caja_id: mongoose.Types.ObjectId.isValid(cajaId) ? new mongoose.Types.ObjectId(cajaId) : cajaId,
        cancelada: { $ne: true }, 
        devuelta: { $ne: true } 
      }},
      { $group: { 
        _id: '$metodo_pago', 
        total: { $sum: '$total' }
      }}
    ]);

    let ventas_efectivo = 0;
    let ventas_tarjeta = 0;
    let ventas_transferencia = 0;
    let ventas_otros = 0;
    let ventas_dolar = 0;
    let total_dolar = 0;

    salesByMethod.forEach(sale => {
      const metodo = sale._id?.toLowerCase();
      switch (metodo) {
        case 'efectivo':
          ventas_efectivo = sale.total || 0;
          break;
        case 'tarjeta':
        case 'credito':
        case 'debito':
          ventas_tarjeta = sale.total || 0;
          break;
        case 'transferencia':
          ventas_transferencia = sale.total || 0;
          break;
        case 'usd':
        case 'dolar':
          ventas_efectivo += sale.total || 0;
          ventas_dolar = sale.total || 0;
          break;
        default:
          ventas_otros += sale.total || 0;
      }
    });

    // Obtener el total en dólares (excluyendo devueltas)
    const dollarSales = await Sale.aggregate([
      { $match: { 
        caja_id: mongoose.Types.ObjectId.isValid(cajaId) ? new mongoose.Types.ObjectId(cajaId) : cajaId,
        cancelada: { $ne: true },
        devuelta: { $ne: true },
        metodo_pago: { $in: ['usd', 'dolar'] }
      }},
      { $group: { _id: null, total_dolar: { $sum: '$monto_dolar' } }}
    ]);
    total_dolar = dollarSales[0]?.total_dolar || 0;

    // Calcular total de descuentos (excluyendo devueltas)
    const discountDetails = await SaleDetail.aggregate([
      { $lookup: { from: 'sales', localField: 'venta_id', foreignField: '_id', as: 'venta' }},
      { $match: { 
        'venta.caja_id': mongoose.Types.ObjectId.isValid(cajaId) ? new mongoose.Types.ObjectId(cajaId) : cajaId,
        'venta.cancelada': { $ne: true },
        'venta.devuelta': { $ne: true },
        descuento: { $gt: 0 }
      }},
      { $project: { precio: 1, cantidad: 1, descuento: 1 }}
    ]);

    let total_descuentos = 0;
    discountDetails.forEach(detail => {
      const discountAmount = detail.precio * (detail.descuento / 100) * detail.cantidad;
      total_descuentos += discountAmount;
    });
    total_descuentos = Number(total_descuentos.toFixed(2));

    // Obtener total de devoluciones
    const cashRegister = await CashRegister.findById(cajaId);
    const total_devoluciones = cashRegister?.total_devoluciones || 0;

    return {
      ventas_efectivo,
      ventas_tarjeta,
      ventas_transferencia,
      ventas_otros,
      ventas_dolar,
      total_dolar,
      total_descuentos,
      total_devoluciones
    };
  } catch (error) {
    console.error('Error al obtener resumen de ventas:', error);
    throw error;
  }
}

/**
 * Obtiene todas las cajas con filtros opcionales
 * @param {Object} filters - Filtros de búsqueda
 * @returns {Array} Lista de cajas
 */
export async function getAllCashRegisters(filters = {}) {
  try {
    const { startDate, endDate, estado, usuario_id } = filters;

    const query = {};
    if (startDate || endDate) {
      query.fecha_apertura = {};
      if (startDate) query.fecha_apertura.$gte = new Date(startDate);
      if (endDate) query.fecha_apertura.$lte = new Date(endDate);
    }
    if (estado) query.estado = estado;
    if (usuario_id) query.usuario_id = usuario_id;

    const cashRegisters = await CashRegister.find(query)
      .populate('usuario_id', 'nombre')
      .sort({ fecha_apertura: -1 });
    return cashRegisters;
  } catch (error) {
    console.error('Error al obtener cajas:', error);
    throw error;
  }
}

/**
 * Obtiene todas las cajas de un usuario específico
 * @param {string} usuarioId - ID del usuario
 * @returns {Array} Lista de cajas del usuario
 */
export async function getCashRegistersByUser(usuarioId) {
  try {
    const cashRegisters = await CashRegister.find({ usuario_id: usuarioId })
      .populate('usuario_id', 'nombre')
      .sort({ fecha_apertura: -1 });
    return cashRegisters;
  } catch (error) {
    console.error('Error al obtener cajas del usuario:', error);
    throw error;
  }
}

/**
 * Actualiza el ID de caja en una venta
 * @param {string} ventaId - ID de la venta
 * @param {string} cajaId - ID de la caja
 */
export async function updateSaleCashRegister(ventaId, cajaId) {
  try {
    await Sale.findByIdAndUpdate(ventaId, { caja_id: cajaId });
  } catch (error) {
    console.error('Error al actualizar caja de venta:', error);
    throw error;
  }
}
