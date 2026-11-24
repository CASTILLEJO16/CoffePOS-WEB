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
    console.log('[getOpenCashRegisterByUser] Buscando caja con usuario_id:', usuarioId, 'estado: abierta');

    const cashRegister = await CashRegister.findOne({
      usuario_id: usuarioId,
      estado: 'abierta'
    })
    .populate('usuario_id', 'nombre')
    .sort({ fecha_apertura: -1 })
    .limit(1);

    console.log('[getOpenCashRegisterByUser] Resultado:', cashRegister ? 'Encontrada' : 'No encontrada');

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

    // Evitar que la misma caja (por nombre) sea usada por otro usuario DENTRO DE LA MISMA CAFETERÍA (clientId)
    // Cada cafetería (clientId) tiene su propio espacio de nombres de cajas
    if (nombre_caja) {
      const cajaEnUso = await CashRegister.findOne({ 
        nombre_caja,
        clientId,
        estado: 'abierta' 
      }).limit(1);

      if (cajaEnUso) {
        throw new Error('Esta caja ya está en uso por otro usuario');
      }
    }

    try {
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
    } catch (createError) {
      // Manejar condición de carrera por índice único parcial (E11000)
      if (createError.code === 11000) {
        throw new Error('Esta caja ya está en uso por otro usuario en esta cafetería');
      }
      throw createError;
    }
  } catch (error) {
    console.error('Error al abrir caja:', error);
    throw error;
  }
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Resumen de una caja: UNA sola fórmula, usada por la vista previa y por el cierre.
 *
 * - Solo cuenta ventas no canceladas y no devueltas (una devolución saca la venta del
 *   cálculo; NO se vuelve a restar aparte, antes se restaba dos veces).
 * - Efectivo esperado en caja (MXN) = fondo inicial
 *     + ventas en efectivo
 *     + ventas en dólares (equivalente MXN)
 *     + parte en efectivo de pagos mixtos (MXN + USD×TC − cambio entregado)
 * - Los descuentos NO se restan: el precio cobrado ya trae el descuento. Se reportan
 *   solo como dato informativo.
 * @param {string} cajaId
 */
export async function getSalesSummaryByCashRegister(cajaId) {
  const cajaObjectId = mongoose.Types.ObjectId.isValid(cajaId) ? new mongoose.Types.ObjectId(cajaId) : cajaId;
  const caja = await CashRegister.findById(cajaObjectId);
  if (!caja) throw new Error('Caja no encontrada');

  const sales = await Sale.find({ caja_id: cajaObjectId, cancelada: { $ne: true } }).lean();
  const validSales = sales.filter(s => s.devuelta !== true);
  const refundedSales = sales.filter(s => s.devuelta === true);

  let ventas_efectivo = 0;
  let ventas_tarjeta = 0;
  let ventas_transferencia = 0;
  let ventas_otros = 0;
  let ventas_dolar = 0;
  let total_dolar = 0;
  let total_vendido = 0;
  let descuentos_promociones = 0;

  for (const sale of validSales) {
    const total = Number(sale.total) || 0;
    total_vendido += total;
    descuentos_promociones += Number(sale.descuento_promociones) || 0;
    const metodo = String(sale.metodo_pago || '').toLowerCase();

    switch (metodo) {
      case 'efectivo':
        ventas_efectivo += total;
        break;
      case 'tarjeta':
      case 'credito':
      case 'debito':
        ventas_tarjeta += total;
        break;
      case 'transferencia':
        ventas_transferencia += total;
        break;
      case 'usd':
      case 'dolar':
        // El cajón recibe dólares; se reporta su equivalente en MXN dentro del efectivo
        ventas_efectivo += total;
        ventas_dolar += total;
        total_dolar += Number(sale.monto_dolar) || 0;
        break;
      case 'mixto': {
        const tc = Number(sale.tipo_cambio) || 0;
        const usd = Number(sale.efectivo_usd) || 0;
        const cards = (Number(sale.tarjeta_credito) || 0) + (Number(sale.tarjeta_debito) || 0);
        const cash = (Number(sale.efectivo_mxn) || 0) + usd * tc - (Number(sale.cambio_pesos) || 0);
        ventas_efectivo += cash;
        ventas_tarjeta += cards;
        if (usd > 0) {
          ventas_dolar += usd * tc;
          total_dolar += usd;
        }
        // Si los montos no cuadran con el total (datos viejos), el resto va a "otros"
        const resto = round2(total - cash - cards);
        if (Math.abs(resto) > 0.01) ventas_otros += resto;
        break;
      }
      default:
        ventas_otros += total;
    }
  }

  // Descuentos de producto (informativo): precio cobrado ya trae el % de descuento
  let descuentos_producto = 0;
  if (validSales.length > 0) {
    const details = await SaleDetail.find({
      venta_id: { $in: validSales.map(s => s._id) },
      descuento: { $gt: 0, $lt: 100 }
    }).select('precio cantidad descuento').lean();
    for (const d of details) {
      const pct = Number(d.descuento) / 100;
      const original = Number(d.precio) / (1 - pct);
      descuentos_producto += (original - Number(d.precio)) * (Number(d.cantidad) || 0);
    }
  }

  const fondo_inicial = Number(caja.fondo_inicial) || 0;
  const total_devoluciones = round2(refundedSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0));

  return {
    fondo_inicial,
    ventas_efectivo: round2(ventas_efectivo),
    ventas_tarjeta: round2(ventas_tarjeta),
    ventas_transferencia: round2(ventas_transferencia),
    ventas_otros: round2(ventas_otros),
    ventas_dolar: round2(ventas_dolar),
    total_dolar: round2(total_dolar),
    total_vendido: round2(total_vendido),
    total_descuentos: round2(descuentos_producto + descuentos_promociones),
    total_devoluciones,
    numero_ventas: validSales.length,
    total_esperado: round2(fondo_inicial + ventas_efectivo)
  };
}

/**
 * Cierra una caja usando el MISMO resumen que se muestra antes de cerrar.
 * @param {string} id - ID de la caja
 * @param {Object} data - { total_contado, observaciones }
 * @returns {Object} Caja cerrada
 */
export async function closeCashRegister(id, data) {
  try {
    const { observaciones } = data;
    const total_contado = round2(Number(data.total_contado) || 0);

    const caja = await getCashRegisterById(id);
    if (!caja) throw new Error('Caja no encontrada');
    if (caja.estado !== 'abierta') throw new Error('La caja ya está cerrada');

    const summary = await getSalesSummaryByCashRegister(id);
    const diferencia = round2(total_contado - summary.total_esperado);

    // Cierre atómico: solo si sigue abierta (evita doble cierre simultáneo)
    const updatedCashRegister = await CashRegister.findOneAndUpdate(
      { _id: id, estado: 'abierta' },
      {
        fecha_cierre: new Date(),
        ventas_efectivo: summary.ventas_efectivo,
        ventas_tarjeta: summary.ventas_tarjeta,
        ventas_transferencia: summary.ventas_transferencia,
        ventas_otros: summary.ventas_otros,
        ventas_dolar: summary.ventas_dolar,
        total_dolar: summary.total_dolar,
        total_vendido: summary.total_vendido,
        total_descuentos: summary.total_descuentos,
        total_devoluciones: summary.total_devoluciones,
        total_esperado: summary.total_esperado,
        total_contado,
        diferencia,
        observaciones,
        estado: 'cerrada'
      },
      { new: true }
    );
    if (!updatedCashRegister) throw new Error('La caja ya está cerrada');

    return updatedCashRegister;
  } catch (error) {
    console.error('Error al cerrar caja:', error.message);
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
    const { startDate, endDate, estado, usuario_id, clientId } = filters;

    const query = {};
    if (startDate || endDate) {
      query.fecha_apertura = {};
      if (startDate) query.fecha_apertura.$gte = new Date(startDate);
      if (endDate) query.fecha_apertura.$lte = new Date(endDate);
    }
    if (estado) query.estado = estado;
    if (usuario_id) query.usuario_id = usuario_id;
    if (clientId) query.clientId = clientId;

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
