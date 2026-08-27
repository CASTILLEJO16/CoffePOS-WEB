import mongoose from 'mongoose';
import Sale from '../models/Sale.js';
import SaleDetail from '../models/SaleDetail.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import CashRegister from '../models/CashRegister.js';
import { config } from '../config/config.js';
import { logAction } from './logService.js';
import { getOpenCashRegisterByUser } from './cashRegisterService.js';
import { formatInTimeZone } from 'date-fns-tz';
import Config from '../models/Config.js';
import Ingredient from '../models/Ingredient.js';
import Recipe from '../models/Recipe.js';
import RecipePersonalization from '../models/RecipePersonalization.js';
import Personalization from '../models/Personalization.js';

/**
 * Servicio de Ventas
 * Contiene toda la lógica de negocio relacionada con ventas
 */

/**
 * Obtiene todas las ventas
 * @param {number} limit - Límite de registros
 * @param {number} offset - Offset para paginación
 * @param {string} usuarioId - ID del usuario (opcional, para filtrar)
 * @returns {Array} Lista de ventas
 */
export async function getSales(limit = 100, offset = 0, usuarioId = null) {
  try {
    const query = { cancelada: { $ne: true } };
    if (usuarioId) {
      query.usuario_id = usuarioId;
    }

    const sales = await Sale.find(query)
      .populate('usuario_id', 'nombre')
      .sort({ fecha: -1 })
      .limit(limit)
      .skip(offset);
    return sales;
  } catch (error) {
    console.error('Error al obtener ventas:', error);
    throw error;
  }
}

/**
 * Obtiene todas las ventas de un usuario específico
 * @param {string} usuarioId - ID del usuario
 * @returns {Array} Lista de ventas del usuario
 */
export async function getSalesByUser(usuarioId) {
  try {
    const sales = await Sale.find({ 
      usuario_id: usuarioId, 
      cancelada: { $ne: true } 
    })
    .populate('usuario_id', 'nombre')
    .sort({ fecha: -1 });
    return sales;
  } catch (error) {
    console.error('Error al obtener ventas del usuario:', error);
    throw error;
  }
}

/**
 * Obtiene una venta por su ID con sus detalles
 * @param {string} id - ID de la venta
 * @returns {Object} Venta con detalles
 */
export async function getSaleById(id) {
  try {
    const sale = await Sale.findById(id)
      .populate('usuario_id', 'nombre');

    if (!sale) {
      return null;
    }

    const details = await SaleDetail.find({ venta_id: id })
      .populate('producto_id', 'nombre');

    // Parsear personalizaciones de JSON
    const detailsWithParsedCustomizations = details.map(detail => ({
      ...detail.toObject(),
      personalizaciones: detail.personalizaciones ? JSON.parse(detail.personalizaciones) : null
    }));

    return {
      ...sale.toObject(),
      detalles: detailsWithParsedCustomizations
    };
  } catch (error) {
    console.error('Error al obtener venta:', error);
    throw error;
  }
}

/**
 * Crea una nueva venta con sus detalles
 * @param {Object} saleData - Datos de la venta
 * @param {string} usuarioId - ID del usuario
 * @returns {Object} Venta creada con detalles
 */
export async function createSale(saleData, usuarioId = null) {
  try {
    const session = await Sale.startSession();
    session.startTransaction();

    const { items, metodo_pago = 'efectivo', iva_rate: ivaFromClient } = saleData;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('La venta debe tener al menos un producto');
    }

    // Obtener caja abierta del usuario
    const openCashRegister = await getOpenCashRegisterByUser(usuarioId);
    if (!openCashRegister) {
      throw new Error('No hay una caja abierta. Debe abrir una caja antes de realizar ventas.');
    }

    // Calcular totales
    let subtotal = 0;
    const processedItems = [];

    for (const item of items) {
      if (!item.cantidad || item.cantidad <= 0) {
        throw new Error('Cantidad inválida');
      }
      const product = await Product.findOne({ 
        _id: item.producto_id, 
        activo: true 
      });

      if (!product) {
        throw new Error(`Producto con ID ${item.producto_id} no encontrado o inactivo`);
      }

      const cantidad = item.cantidad;
      let precio = product.precio;
      if (item.precio_final !== undefined && item.precio_final !== null) {
        const parsed = parseFloat(item.precio_final);
        if (!Number.isNaN(parsed) && parsed > 0) {
          precio = parsed;
        }
      }

      const importe = cantidad * precio;
      const personalizaciones = item.personalizaciones ? JSON.stringify(item.personalizaciones) : null;

      subtotal += importe;

      processedItems.push({
        producto_id: product._id,
        producto_nombre: product.nombre,
        cantidad,
        precio,
        importe,
        personalizaciones
      });

      // Verificar si el producto tiene receta
      const receta = await Recipe.findOne({ producto_id: product._id });

      // Solo descontar stock si NO tiene receta
      if (!receta) {
        try {
          if (product.stock !== undefined && product.stock !== null) {
            const newStock = product.stock - cantidad;
            await Product.findByIdAndUpdate(product._id, { stock: newStock });
          }
        } catch (e) {
          console.error('Error actualizando stock de producto:', e);
        }
      }
    }

    // Calcular impuestos y total
    let ivaRate = 0.16;
    if (ivaFromClient !== undefined && ivaFromClient !== null) {
      const parsed = parseFloat(ivaFromClient);
      if (!Number.isNaN(parsed)) {
        ivaRate = parsed;
      }
    } else {
      // fallback: configuración en BD
      try {
        const ivaRow = await Config.findOne({ clave: 'iva_rate' });
        if (ivaRow && ivaRow.valor) {
          ivaRate = parseFloat(ivaRow.valor);
        }
      } catch {}
    }

    const impuestos = Number((subtotal * ivaRate).toFixed(2));
    const total = Number((subtotal + impuestos).toFixed(2));

    // Lógica de almacén
    const configRow = await Config.findOne({ clave: 'permitir_stock_negativo' });
    const allowNegativeStock = configRow ? (configRow.valor === '1' || configRow.valor === 'true') : false;
    
    const ingredientNeeds = {};

    for (const item of items) {
      const qty = item.cantidad;
      
      // Obtener la receta base del producto
      const baseRecipe = await Recipe.aggregate([
        { $match: { producto_id: mongoose.Types.ObjectId.isValid(item.producto_id) ? new mongoose.Types.ObjectId(item.producto_id) : item.producto_id }},
        { $lookup: { from: 'ingredients', localField: 'ingrediente_id', foreignField: '_id', as: 'ingrediente' }},
        { $unwind: '$ingrediente' },
        { $match: { 'ingrediente.activo': true }},
        { $project: { 
          ingrediente_id: 1, 
          cantidad: 1, 
          nombre: '$ingrediente.nombre', 
          unidad_medida: '$ingrediente.unidad_medida', 
          categoria_reemplazo: '$ingrediente.categoria_reemplazo' 
        }}
      ]);

      // Identificar categorías de personalización seleccionadas
      const categoriesToReplace = new Set();
      const customRecipesToApply = [];

      if (item.personalizaciones) {
        let opcionesSeleccionadas = [];
        if (Array.isArray(item.personalizaciones)) {
          opcionesSeleccionadas = item.personalizaciones;
        } else if (typeof item.personalizaciones === 'object') {
          opcionesSeleccionadas = Object.values(item.personalizaciones).flat();
        }

        for (const opcion of opcionesSeleccionadas) {
          if (!opcion?.id) continue;
          
          // Obtener la personalización para identificar su tipo
          const customDb = await Personalization.findOne({ _id: opcion.id, activo: true });
          if (customDb && customDb.tipo) {
            categoriesToReplace.add(customDb.tipo);
          }

          // Obtener la receta de la personalización (ingredientes adicionales)
          const custRecipe = await RecipePersonalization.aggregate([
            { $match: { personalizacion_id: mongoose.Types.ObjectId.isValid(opcion.id) ? new mongoose.Types.ObjectId(opcion.id) : opcion.id }},
            { $lookup: { from: 'ingredients', localField: 'ingrediente_id', foreignField: '_id', as: 'ingrediente' }},
            { $unwind: '$ingrediente' },
            { $match: { 'ingrediente.activo': true }},
            { $project: { ingrediente_id: 1, cantidad: 1, nombre: '$ingrediente.nombre', unidad_medida: '$ingrediente.unidad_medida' }}
          ]);
          
          customRecipesToApply.push(...custRecipe);
        }
      }

      // Filtrar receta base: omitir ingredientes que tienen categoría de reemplazo
      // si el cliente seleccionó una personalización de esa categoría
      const finalBaseRecipe = baseRecipe.filter(br => {
        if (br.categoria_reemplazo && categoriesToReplace.has(br.categoria_reemplazo)) {
          return false; // Omitir este ingrediente de la receta base
        }
        return true; // Mantener este ingrediente
      });

      // Sumar ingredientes de la receta base filtrada
      for (const row of finalBaseRecipe) {
        const key = row.ingrediente_id;
        if (!ingredientNeeds[key]) {
          ingredientNeeds[key] = { nombre: row.nombre, unidad_medida: row.unidad_medida, cantidad: 0 };
        }
        ingredientNeeds[key].cantidad += row.cantidad * qty;
      }

      // Sumar ingredientes de las personalizaciones seleccionadas
      for (const row of customRecipesToApply) {
        const key = row.ingrediente_id;
        if (!ingredientNeeds[key]) {
          ingredientNeeds[key] = { nombre: row.nombre, unidad_medida: row.unidad_medida, cantidad: 0 };
        }
        ingredientNeeds[key].cantidad += row.cantidad * qty;
      }
    }
    
    // Verificar disponibilidad
    const faltantes = [];
    for (const [ingId, need] of Object.entries(ingredientNeeds)) {
      if (need.cantidad <= 0) continue;
      const ingRow = await Ingredient.findById(ingId);
      if (ingRow && ingRow.stock_actual < need.cantidad && !allowNegativeStock) {
        faltantes.push(`${need.nombre} (tiene ${ingRow.stock_actual}${need.unidad_medida}, necesita ${need.cantidad}${need.unidad_medida})`);
      }
    }
    if (faltantes.length > 0) {
      throw new Error(`Stock insuficiente para procesar la venta. Ingredientes faltantes:\n${faltantes.join('\n')}`);
    }
    
    // Descontar stocks
    for (const [ingId, need] of Object.entries(ingredientNeeds)) {
      if (need.cantidad <= 0) continue;
      await Ingredient.findByIdAndUpdate(ingId, { $inc: { stock_actual: -need.cantidad } });
    }

    // Manejar pagos en dólar
    let tipoCambio = null;
    let montoDolar = null;
    let dolarRecibido = null;
    let cambioPesos = null;
    let efectivoMxn = 0;
    let efectivoUsd = 0;
    let tarjetaCredito = 0;
    let tarjetaDebito = 0;

    if (metodo_pago === 'dolar') {
      tipoCambio = saleData.tipo_cambio || 20.00;
      montoDolar = Number((total / tipoCambio).toFixed(2));
      dolarRecibido = saleData.dolar_recibido || montoDolar;
      cambioPesos = Number(((dolarRecibido - montoDolar) * tipoCambio).toFixed(2));
    } else if (metodo_pago === 'mixto') {
      tipoCambio = saleData.tipo_cambio || 20.00;
      efectivoMxn = saleData.efectivo_mxn || 0;
      efectivoUsd = saleData.efectivo_usd || 0;
      tarjetaCredito = saleData.tarjeta_credito || 0;
      tarjetaDebito = saleData.tarjeta_debito || 0;
      cambioPesos = saleData.cambio_pesos || 0;
    }

    // Generar número de venta secuencial
    const lastSale = await Sale.findOne().sort({ numero_venta: -1 });
    const nextNumeroVenta = lastSale && lastSale.numero_venta ? lastSale.numero_venta + 1 : 1;

    const newSale = await Sale.create([{
      numero_venta: nextNumeroVenta,
      subtotal,
      impuestos,
      total,
      metodo_pago,
      tipo_tarjeta: saleData.tipo_tarjeta || null,
      usuario_id: usuarioId,
      caja_id: openCashRegister._id,
      fecha: new Date(),
      tipo_cambio: tipoCambio,
      monto_dolar: montoDolar,
      dolar_recibido: dolarRecibido,
      cambio_pesos: cambioPesos,
      efectivo_mxn: efectivoMxn,
      efectivo_usd: efectivoUsd,
      tarjeta_credito: tarjetaCredito,
      tarjeta_debito: tarjetaDebito,
      iva_rate: ivaRate
    }], { session });

    const ventaId = newSale[0]._id;

    // Insertar detalles
    for (const item of processedItems) {
      const product = await Product.findById(item.producto_id);
      const descuento = product ? (product.descuento || 0) : 0;

      await SaleDetail.create([{
        venta_id: ventaId,
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        precio: item.precio,
        importe: item.importe,
        personalizaciones: item.personalizaciones,
        descuento
      }], { session });
    }

    // Registrar log
    await logAction(usuarioId, 'CREAR_VENTA', `Venta creada: Total: $${total.toFixed(2)}`);

    await session.commitTransaction();
    session.endSession();

    const result = await getSaleById(ventaId);
    result.iva_rate = ivaRate;

    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * Cancela una venta (marca como cancelada)
 * @param {string} id - ID de la venta
 * @param {string} usuarioId - ID del usuario que cancela
 */
export async function cancelSale(id, usuarioId = null) {
  try {
    const session = await Sale.startSession();
    session.startTransaction();

    const sale = await getSaleById(id);
    
    if (!sale) {
      throw new Error('Venta no encontrada');
    }

    if (sale.cancelada) {
      throw new Error('La venta ya fue cancelada');
    }

    // Revertir stock de ingredientes
    const ingredientMap = {};

    for (const item of sale.detalles) {
      const qty = item.cantidad;

      const baseRecipe = await Recipe.find({ producto_id: item.producto_id });

      for (const row of baseRecipe) {
        if (!ingredientMap[row.ingrediente_id]) {
          ingredientMap[row.ingrediente_id] = 0;
        }
        ingredientMap[row.ingrediente_id] += row.cantidad * qty;
      }

      if (item.personalizaciones) {
        let opciones = [];
        try {
          opciones = Array.isArray(item.personalizaciones)
            ? item.personalizaciones
            : Object.values(item.personalizaciones).flat();
        } catch {
          opciones = [];
        }

        for (const opcion of opciones) {
          if (!opcion?.id) continue;

          const custRecipe = await RecipePersonalization.find({ personalizacion_id: opcion.id });

          for (const row of custRecipe) {
            if (!ingredientMap[row.ingrediente_id]) {
              ingredientMap[row.ingrediente_id] = 0;
            }
            ingredientMap[row.ingrediente_id] += row.cantidad * qty;
          }
        }
      }
    }

    // Regresar stock
    for (const [ingId, cantidad] of Object.entries(ingredientMap)) {
      await Ingredient.findByIdAndUpdate(ingId, { $inc: { stock_actual: cantidad } });
    }

    // Marcar como cancelada
    await Sale.findByIdAndUpdate(id, { cancelada: true });

    // Registrar cancelación
    await logAction(usuarioId, 'CANCELAR_VENTA', `Venta cancelada: Total: $${sale.total}`);

    await session.commitTransaction();
    session.endSession();
  } catch (error) {
    console.error('Error al cancelar venta:', error.message);
    throw error;
  }
}

/**
 * Obtiene las ventas de un día específico
 * @param {string} date - Fecha en formato YYYY-MM-DD
 * @param {string|null} usuarioId - Filtrar por vendedor
 * @returns {Array} Lista de ventas del día
 */
export async function getSalesByDate(date, usuarioId = null) {
  try {
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const query = {
      fecha: { $gte: startDate, $lte: endDate },
      cancelada: { $ne: true }
    };

    if (usuarioId) {
      query.usuario_id = usuarioId;
    }

    const sales = await Sale.find(query)
      .populate('usuario_id', 'nombre')
      .sort({ fecha: -1 });

    return await attachSaleDetails(sales);
  } catch (error) {
    console.error('Error al obtener ventas por fecha:', error);
    throw error;
  }
}

/**
 * Obtiene el resumen de ventas de un día
 * @param {string} date - Fecha en formato YYYY-MM-DD
 * @returns {Object} Resumen de ventas
 */
export async function getDailySummary(date) {
  try {
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const summary = await Sale.aggregate([
      { $match: { 
        fecha: { $gte: startDate, $lte: endDate },
        cancelada: { $ne: true }
      }},
      { $group: {
        _id: null,
        total_ventas: { $sum: 1 },
        subtotal: { $sum: '$subtotal' },
        impuestos: { $sum: '$impuestos' },
        total: { $sum: '$total' }
      }}
    ]);

    return summary[0] || { total_ventas: 0, subtotal: 0, impuestos: 0, total: 0 };
  } catch (error) {
    console.error('Error al obtener resumen diario:', error);
    throw error;
  }
}

/**
 * Obtiene las ventas de un rango de fechas
 * @param {string} startDate - Fecha inicio YYYY-MM-DD
 * @param {string} endDate - Fecha fin YYYY-MM-DD
 * @param {string|null} usuarioId - Filtrar por vendedor
 * @returns {Array} Lista de ventas en el rango
 */
export async function getSalesByDateRange(startDate, endDate, usuarioId = null) {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const query = {
      fecha: { $gte: start, $lte: end },
      cancelada: { $ne: true }
    };

    if (usuarioId) {
      query.usuario_id = usuarioId;
    }

    const sales = await Sale.find(query)
      .populate('usuario_id', 'nombre')
      .sort({ fecha: -1 });

    return await attachSaleDetails(sales);
  } catch (error) {
    console.error('Error al obtener ventas por rango de fechas:', error);
    throw error;
  }
}

/**
 * Adjunta detalles de productos a una lista de ventas
 */
async function attachSaleDetails(sales) {
  if (!sales || sales.length === 0) return sales || [];

  const ids = sales.map(s => s._id);
  const details = await SaleDetail.find({ venta_id: { $in: ids } })
    .populate('producto_id', 'nombre');

  const bySale = {};
  for (const detail of details) {
    if (!bySale[detail.venta_id]) bySale[detail.venta_id] = [];
    bySale[detail.venta_id].push({
      ...detail.toObject(),
      personalizaciones: detail.personalizaciones
        ? JSON.parse(detail.personalizaciones)
        : null
    });
  }

  return sales.map(sale => ({
    ...sale.toObject(),
    detalles: bySale[sale._id] || []
  }));
}

/**
 * Obtiene KPIs de ventas con filtros por período o año específico
 * @param {string} period - 'day', 'week', 'month', 'year'
 * @param {string} startDate - Fecha inicio (opcional)
 * @param {string} endDate - Fecha fin (opcional)
 * @param {string|number} selectedYear - Año específico (opcional)
 * @returns {Object} KPIs de ventas
 */
export async function getSalesKPIs(period = 'day', startDate = null, endDate = null, selectedYear = null) {
  try {
    let dateFilter = {};
    const now = new Date();
    
    if (selectedYear) {
      dateFilter = {
        $gte: new Date(selectedYear, 0, 1),
        $lt: new Date(selectedYear + 1, 0, 1)
      };
    } else if (startDate && endDate) {
      dateFilter = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else {
      switch (period) {
        case 'day':
          dateFilter = {
            $gte: new Date(now.setHours(0, 0, 0, 0)),
            $lt: new Date(now.setHours(23, 59, 59, 999))
          };
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          dateFilter = { $gte: weekAgo };
          break;
        case 'month':
          dateFilter = {
            $gte: new Date(now.getFullYear(), now.getMonth(), 1),
            $lt: new Date(now.getFullYear(), now.getMonth() + 1, 0)
          };
          break;
        case 'year':
          dateFilter = {
            $gte: new Date(now.getFullYear(), 0, 1),
            $lt: new Date(now.getFullYear() + 1, 0, 1)
          };
          break;
        default:
          dateFilter = {
            $gte: new Date(now.setHours(0, 0, 0, 0)),
            $lt: new Date(now.setHours(23, 59, 59, 999))
          };
      }
    }

    const matchQuery = { fecha: dateFilter, cancelada: { $ne: true } };

    // Años disponibles
    const availableYears = await Sale.aggregate([
      { $match: matchQuery },
      { $group: { _id: { $year: '$fecha' } } },
      { $sort: { _id: -1 } }
    ]);
    const aniosDisponibles = availableYears.map(y => String(y._id)).sort((a, b) => b.localeCompare(a));

    // KPIs generales
    const generalKPIs = await Sale.aggregate([
      { $match: matchQuery },
      { $group: {
        _id: null,
        total_ventas: { $sum: 1 },
        subtotal: { $sum: '$subtotal' },
        impuestos: { $sum: '$impuestos' },
        total: { $sum: '$total' },
        ticket_promedio: { $avg: '$total' }
      }}
    ]);

    // Ventas por método de pago
    const paymentMethods = await Sale.aggregate([
      { $match: matchQuery },
      { $group: {
        _id: { metodo_pago: '$metodo_pago', tipo_tarjeta: '$tipo_tarjeta' },
        cantidad: { $sum: 1 },
        total: { $sum: '$total' }
      }}
    ]);

    // Ventas por hora
    const hourlySales = await Sale.aggregate([
      { $match: matchQuery },
      { $group: {
        _id: { $hour: '$fecha' },
        cantidad_ventas: { $sum: 1 },
        total_ventas: { $sum: '$total' }
      }},
      { $sort: { _id: 1 } }
    ]);

    // Productos más vendidos
    const topProducts = await SaleDetail.aggregate([
      { $lookup: { from: 'sales', localField: 'venta_id', foreignField: '_id', as: 'venta' }},
      { $match: { 'venta.fecha': dateFilter, 'venta.cancelada': { $ne: true } } },
      { $group: {
        _id: '$producto_id',
        cantidad_vendida: { $sum: '$cantidad' },
        total_ingresos: { $sum: '$importe' }
      }},
      { $sort: { cantidad_vendida: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'producto' }},
      { $unwind: '$producto' },
      { $project: {
        producto_nombre: '$producto.nombre',
        cantidad_vendida: 1,
        total_ingresos: 1
      }}
    ]);

    // Ventas por día
    const dailySales = await Sale.aggregate([
      { $match: matchQuery },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$fecha' } },
        cantidad_ventas: { $sum: 1 },
        total_ventas: { $sum: '$total' }
      }},
      { $sort: { _id: 1 } }
    ]);

    // Ventas por mes
    const monthlySales = await Sale.aggregate([
      { $match: matchQuery },
      { $group: {
        _id: { $month: '$fecha' },
        cantidad_ventas: { $sum: 1 },
        total_ventas: { $sum: '$total' }
      }},
      { $sort: { _id: 1 } }
    ]);

    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthlyMap = {};
    monthlySales.forEach(m => {
      monthlyMap[m._id] = {
        ventas: m.cantidad_ventas || 0,
        total: m.total_ventas || 0
      };
    });

    const fullYearMonths = monthNames.map((nombre, idx) => ({
      mes: nombre,
      mes_num: String(idx + 1).padStart(2, '0'),
      ventas: monthlyMap[idx + 1] ? monthlyMap[idx + 1].ventas : 0,
      total: monthlyMap[idx + 1] ? monthlyMap[idx + 1].total : 0
    }));

    return {
      general: {
        total_ventas: generalKPIs[0]?.total_ventas || 0,
        subtotal: generalKPIs[0]?.subtotal || 0,
        impuestos: generalKPIs[0]?.impuestos || 0,
        total: generalKPIs[0]?.total || 0,
        ticket_promedio: generalKPIs[0]?.ticket_promedio || 0
      },
      por_metodo_pago: paymentMethods || [],
      por_hora: hourlySales || [],
      productos_top: topProducts || [],
      por_dia: dailySales || [],
      por_mes: fullYearMonths,
      anios_disponibles: aniosDisponibles
    };
  } catch (error) {
    console.error('Error al obtener KPIs de ventas:', error);
    throw error;
  }
}

/**
 * Devuelve una venta
 * @param {string} saleId - ID de la venta a devolver
 * @param {string} userId - ID del usuario que realiza la devolución
 * @param {string} motivo - Motivo de la devolución
 */
export async function refundSale(saleId, userId, motivo = '') {
  try {
    const session = await Sale.startSession();
    session.startTransaction();

    const sale = await getSaleById(saleId);
    if (!sale) {
      throw new Error('Venta no encontrada');
    }

    if (sale.devuelta === true) {
      throw new Error('La venta ya está devuelta');
    }

    // Marcar la venta como devuelta (no cancelada)
    await Sale.findByIdAndUpdate(saleId, { 
      devuelta: true, 
      motivo_devolucion: motivo || 'Devolución solicitada' 
    });

    // Si la venta está asociada a una caja, actualizar el total de devoluciones
    if (sale.caja_id) {
      await CashRegister.findByIdAndUpdate(sale.caja_id, {
        $inc: { total_devoluciones: sale.total }
      });
    }

    // Devolver el stock de ingredientes (revertir el stock decrementado)
    const saleDetails = await SaleDetail.find({ venta_id: saleId });
    for (const detail of saleDetails) {
      const qty = detail.cantidad;
      
      // Obtener la receta base del producto
      const baseRecipe = await Recipe.aggregate([
        { $match: { producto_id: mongoose.Types.ObjectId.isValid(detail.producto_id) ? new mongoose.Types.ObjectId(detail.producto_id) : detail.producto_id }},
        { $lookup: { from: 'ingredients', localField: 'ingrediente_id', foreignField: '_id', as: 'ingrediente' }},
        { $unwind: '$ingrediente' },
        { $match: { 'ingrediente.activo': true }},
        { $project: { 
          ingrediente_id: 1, 
          cantidad: 1, 
          nombre: '$ingrediente.nombre', 
          unidad_medida: '$ingrediente.unidad_medida', 
          categoria_reemplazo: '$ingrediente.categoria_reemplazo' 
        }}
      ]);

      // Identificar categorías de personalización seleccionadas
      const categoriesToReplace = new Set();
      const customRecipesToApply = ([]);

      if (detail.personalizaciones) {
        let opcionesSeleccionadas = [];
        if (Array.isArray(detail.personalizaciones)) {
          opcionesSeleccionadas = detail.personalizaciones;
        } else if (typeof detail.personalizaciones === 'object') {
          opcionesSeleccionadas = Object.values(detail.personalizaciones).flat();
        }

        for (const opcion of opcionesSeleccionadas) {
          if (!opcion?.id) continue;
          
          // Obtener la personalización para identificar su tipo
          const customDb = await Personalization.findOne({ _id: opcion.id, activo: true });
          if (customDb && customDb.tipo) {
            categoriesToReplace.add(customDb.tipo);
          }

          // Obtener la receta de la personalización (ingredientes adicionales)
          const custRecipe = await RecipePersonalization.aggregate([
            { $match: { personalizacion_id: mongoose.Types.ObjectId.isValid(opcion.id) ? new mongoose.Types.ObjectId(opcion.id) : opcion.id }},
            { $lookup: { from: 'ingredients', localField: 'ingrediente_id', foreignField: '_id', as: 'ingrediente' }},
            { $unwind: '$ingrediente' },
            { $match: { 'ingrediente.activo': true }},
            { $project: { ingrediente_id: 1, cantidad: 1, nombre: '$ingrediente.nombre', unidad_medida: '$ingrediente.unidad_medida' }}
          ]);
          
          customRecipesToApply.push(...custRecipe);
        }
      }

      // Filtrar receta base: omitir ingredientes que tienen categoría de reemplazo
      // si el cliente seleccionó una personalización de esa categoría
      const finalBaseRecipe = baseRecipe.filter(br => {
        if (br.categoria_reemplazo && categoriesToReplace.has(br.categoria_reemplazo)) {
          return false; // Omitir este ingrediente de la receta base
        }
        return true; // Mantener este ingrediente
      });

      // Devolver ingredientes de la receta base filtrada
      for (const row of finalBaseRecipe) {
        await Ingredient.findByIdAndUpdate(row.ingrediente_id, { $inc: { stock_actual: row.cantidad * qty } });
      }

      // Devolver ingredientes de las personalizaciones seleccionadas
      for (const row of customRecipesToApply) {
        await Ingredient.findByIdAndUpdate(row.ingrediente_id, { $inc: { stock_actual: row.cantidad * qty } });
      }
    }

    // Registrar la devolución
    await logAction(userId, 'DEVOLUCION_VENTA', `Venta devuelta: Total: $${sale.total}, Motivo: ${motivo}`);

    await session.commitTransaction();
    session.endSession();
    return sale;
  } catch (error) {
    console.error('Error al devolver venta:', error);
    throw error;
  }
}
