import mongoose from 'mongoose';
import Sale from '../models/Sale.js';
import SaleDetail from '../models/SaleDetail.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import CashRegister from '../models/CashRegister.js';
import { config } from '../config/config.js';
import { logAction } from './logService.js';
import { getOpenCashRegisterByUser } from './cashRegisterService.js';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { BUSINESS_TIMEZONE } from '../utils/dateTime.js';
import Config from '../models/Config.js';
import Ingredient from '../models/Ingredient.js';
import Recipe from '../models/Recipe.js';
import RecipePersonalization from '../models/RecipePersonalization.js';
import Personalization from '../models/Personalization.js';
import Promotion from '../models/Promotion.js';
import { computeBuyXPayYDiscounts, isPromotionActiveNow } from './promotionEngine.js';
import { nextSequence } from '../utils/sequence.js';

/**
 * Servicio de Ventas
 * Contiene toda la lógica de negocio relacionada con ventas
 */

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Extrae las opciones seleccionadas de una personalización (array u objeto {tipo: [opciones]})
 */
function extractSelectedOptions(personalizaciones) {
  if (!personalizaciones) return [];
  if (Array.isArray(personalizaciones)) return personalizaciones;
  if (typeof personalizaciones === 'object') {
    return Object.values(personalizaciones)
      .flat()
      .filter(op => op && typeof op === 'object');
  }
  return [];
}

/**
 * Calcula en el servidor el precio unitario de un producto.
 * Replica la lógica del POS (descuento del producto + extras de personalización y
 * promociones de % o monto fijo) y SOLO acepta el precio enviado por el navegador
 * si coincide con uno de los precios legítimos. Si no coincide, se cobra el precio
 * normal calculado en el servidor.
 */
function resolveServerUnitPrice({ product, personalizaciones, optionPriceMap, promotions, requestedPrice }) {
  const base = Number(product.precio) || 0;
  const desc = Number(product.descuento) || 0;
  const applyProductDiscount = (p) => (desc > 0 ? p * (1 - desc / 100) : p);

  // Extras de personalización con el precio de la BD
  let extras = 0;
  for (const op of extractSelectedOptions(personalizaciones)) {
    if (op?.id) extras += optionPriceMap.get(String(op.id)) || 0;
  }

  const normalPrice = applyProductDiscount(base) + extras;
  const allowed = [normalPrice];

  const productIdStr = product._id.toString();
  for (const promo of promotions || []) {
    const participates = (promo.productosParticipantes || []).some(pp => pp.producto_id?.toString() === productIdStr);
    if (!participates) continue;
    if (promo.tipo === 'PERCENTAGE_DISCOUNT') {
      const promoBase = round2(base * (1 - (Number(promo.descuentoPorcentaje) || 0) / 100));
      allowed.push(applyProductDiscount(promoBase) + extras);
    } else if (promo.tipo === 'FIXED_DISCOUNT') {
      const promoBase = Math.max(0, round2(base - (Number(promo.descuentoFijo) || 0)));
      allowed.push(applyProductDiscount(promoBase) + extras);
    }
  }

  if (requestedPrice !== undefined && requestedPrice !== null && requestedPrice !== '') {
    const requested = parseFloat(requestedPrice);
    if (Number.isFinite(requested)) {
      const match = allowed.find(a => Math.abs(a - requested) <= 0.01);
      if (match !== undefined) return match;
      console.warn(`[createSale] Precio enviado (${requested}) no coincide con los precios válidos de "${product.nombre}" (${allowed.map(a => round2(a)).join(', ')}). Se usa ${round2(normalPrice)}.`);
    }
  }
  return normalPrice;
}

/**
 * Obtiene todas las ventas
 * @param {number} limit - Límite de registros
 * @param {number} offset - Offset para paginación
 * @param {string} usuarioId - ID del usuario (opcional, para filtrar)
 * @returns {Array} Lista de ventas
 */
export async function getSales(limit = 100, offset = 0, usuarioId = null, clientId = null) {
  try {
    const query = { cancelada: { $ne: true } };
    if (usuarioId) {
      // Convertir string a ObjectId si es válido
      if (mongoose.Types.ObjectId.isValid(usuarioId)) {
        query.usuario_id = new mongoose.Types.ObjectId(usuarioId);
      } else {
        query.usuario_id = usuarioId;
      }
    }
    if (clientId) {
      query.clientId = clientId;
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
    const query = { cancelada: { $ne: true } };
    if (mongoose.Types.ObjectId.isValid(usuarioId)) {
      query.usuario_id = new mongoose.Types.ObjectId(usuarioId);
    } else {
      query.usuario_id = usuarioId;
    }
    
    const sales = await Sale.find(query)
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

    // Parsear personalizaciones de JSON y exponer producto_nombre
    const detailsWithParsedCustomizations = details.map(detail => {
      const obj = detail.toObject();
      return {
        ...obj,
        producto_nombre: obj.producto_id?.nombre || obj.producto_nombre || 'Producto',
        personalizaciones: detail.personalizaciones ? JSON.parse(detail.personalizaciones) : null
      };
    });

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
export async function createSale(saleData, usuarioId = null, clientId = null) {
  // Dos cajeros vendiendo el mismo producto a la vez chocan al descontar stock dentro de la
  // transacción (WriteConflict). MongoDB marca esos errores como TransientTransactionError:
  // la transacción se abortó completa y es seguro repetirla.
  const MAX_ATTEMPTS = 10;
  for (let attempt = 1; ; attempt++) {
    try {
      return await createSaleOnce(saleData, usuarioId, clientId);
    } catch (error) {
      const transient = typeof error?.hasErrorLabel === 'function' && error.hasErrorLabel('TransientTransactionError');
      if (!transient || attempt >= MAX_ATTEMPTS) throw error;
      // Espera exponencial con azar (máx ~800ms) para que las ventas en conflicto no choquen otra vez
      const base = Math.min(800, 25 * 2 ** (attempt - 1));
      await new Promise(r => setTimeout(r, Math.floor(base / 2 + Math.random() * base)));
    }
  }
}

async function createSaleOnce(saleData, usuarioId = null, clientId = null) {
  let session;
  try {
    session = await Sale.startSession();
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

    // Optimización: Obtener todos los productos en una sola query (bulk fetch)
    if (!clientId) {
      throw new Error('clientId es requerido para registrar ventas. Vuelve a iniciar sesión.');
    }

    // Validar IDs antes de consultar (evita CastError y datos basura)
    for (const item of items) {
      if (!item || !item.producto_id || !mongoose.Types.ObjectId.isValid(String(item.producto_id))) {
        throw new Error('Producto inválido en la venta');
      }
    }

    const productIds = items.map(item => item.producto_id);
    // SOLO productos de esta cafetería
    const products = await Product.find({
      _id: { $in: productIds },
      clientId,
      activo: true
    });
    const productsMap = new Map(products.map(p => [p._id.toString(), p]));

    // Buscar promociones tipo COMBO para los IDs que no sean productos directos
    const missingProductIds = productIds.filter(id => !productsMap.has(id.toString()));
    const combos = missingProductIds.length > 0
      ? await Promotion.find({
          _id: { $in: missingProductIds },
          clientId,
          tipo: 'COMBO',
          estado: 'Activa'
        })
      : [];
    const combosMap = new Map(combos.map(c => [c._id.toString(), c]));

    // Obtener los productos que componen los combos para cargar sus recetas y stock
    const comboProductIds = [];
    combos.forEach(c => {
      if (c.productosCombo) {
        c.productosCombo.forEach(pc => {
          if (pc.producto_id) comboProductIds.push(pc.producto_id);
        });
      }
    });

    if (comboProductIds.length > 0) {
      const additionalProducts = await Product.find({
        _id: { $in: comboProductIds },
        clientId,
        activo: true
      });
      additionalProducts.forEach(p => productsMap.set(p._id.toString(), p));
    }

    // Optimización: Obtener todas las recetas en una sola query (incluyendo productos de combos)
    const allRelevantProductIds = [...productIds, ...comboProductIds];
    const recipes = await Recipe.find({ 
      producto_id: { $in: allRelevantProductIds },
      clientId 
    });
    const recipesMap = new Map();
    recipes.forEach(r => {
      const key = r.producto_id.toString();
      if (!recipesMap.has(key)) recipesMap.set(key, []);
      recipesMap.get(key).push(r);
    });

    // --- Datos para calcular precios EN EL SERVIDOR (no confiar en el navegador) ---
    // Personalizaciones seleccionadas: su precio adicional se toma de la BD
    const pricingOptionIds = [];
    for (const item of items) {
      for (const op of extractSelectedOptions(item.personalizaciones)) {
        if (op?.id && mongoose.Types.ObjectId.isValid(String(op.id))) pricingOptionIds.push(String(op.id));
      }
    }
    const pricingPersonalizations = pricingOptionIds.length > 0
      ? await Personalization.find({ _id: { $in: pricingOptionIds }, clientId, activo: true })
      : [];
    const optionPriceMap = new Map(pricingPersonalizations.map(p => [p._id.toString(), Number(p.precio_adicional) || 0]));

    // Promociones activas de la cafetería (el POS aplica % y monto fijo al precio unitario)
    const pricingNow = new Date();
    const pricingPromotions = (await Promotion.find({
      clientId,
      estado: 'Activa',
      tipo: { $in: ['PERCENTAGE_DISCOUNT', 'FIXED_DISCOUNT'] }
    })).filter(promo => isPromotionActiveNow(promo, pricingNow));

    for (const item of items) {
      const qtyNum = Number(item.cantidad);
      if (!Number.isFinite(qtyNum) || qtyNum <= 0 || !Number.isInteger(qtyNum)) {
        throw new Error('Cantidad inválida');
      }
      item.cantidad = qtyNum;
      const product = productsMap.get(item.producto_id.toString());
      const combo = combosMap.get(item.producto_id.toString());

      if (!product && !combo) {
        throw new Error(`Producto con ID ${item.producto_id} no encontrado o inactivo`);
      }

      const cantidad = item.cantidad;
      let precio = 0;
      let nombre = '';

      if (combo) {
        // El precio del combo SIEMPRE sale de la BD
        nombre = combo.nombre;
        precio = Number(combo.precioCombo) || 0;
      } else {
        nombre = product.nombre;
        precio = resolveServerUnitPrice({
          product,
          personalizaciones: item.personalizaciones,
          optionPriceMap,
          promotions: pricingPromotions,
          requestedPrice: item.precio_final
        });
      }
      precio = round2(precio);

      const importe = cantidad * precio;
      const personalizaciones = item.personalizaciones ? JSON.stringify(item.personalizaciones) : null;

      subtotal += importe;

      processedItems.push({
        producto_id: combo ? combo._id : product._id,
        producto_nombre: nombre,
        cantidad,
        precio,
        importe,
        personalizaciones,
        isCombo: !!combo,
        comboData: combo || null
      });
    }

    // Acumular necesidades de stock de productos sin receta (se descontará después de validar ingredientes)
    const productStockNeeds = {};
    for (const item of processedItems) {
      if (item.isCombo && item.comboData) {
        for (const pc of (item.comboData.productosCombo || [])) {
          const pId = pc.producto_id.toString();
          const pRecipes = recipesMap.get(pId) || [];
          if (pRecipes.length === 0) {
            const pObj = productsMap.get(pId);
            if (!productStockNeeds[pId]) productStockNeeds[pId] = { product: pObj, cantidad: 0 };
            productStockNeeds[pId].cantidad += (pc.cantidad || 1) * item.cantidad;
          }
        }
      } else {
        const productRecipes = recipesMap.get(item.producto_id.toString()) || [];
        if (productRecipes.length === 0) {
          const key = item.producto_id.toString();
          if (!productStockNeeds[key]) productStockNeeds[key] = { product: productsMap.get(key), cantidad: 0 };
          productStockNeeds[key].cantidad += item.cantidad;
        }
      }
    }

    // Calcular impuestos y total
    // El IVA SIEMPRE se toma de la configuración de la cafetería en la BD.
    // (el iva_rate que manda el navegador se ignora: podía traer cualquier valor)
    let ivaRate = 0.16;
    try {
      const ivaRow = await Config.findOne({ clave: 'iva_rate', clientId });
      const parsedIva = ivaRow ? parseFloat(ivaRow.valor) : NaN;
      if (Number.isFinite(parsedIva) && parsedIva >= 0 && parsedIva < 1) {
        ivaRate = parsedIva;
      }
    } catch {}
    if (ivaFromClient !== undefined && ivaFromClient !== null && Math.abs(parseFloat(ivaFromClient) - ivaRate) > 0.0001) {
      console.warn(`[createSale] IVA del navegador (${ivaFromClient}) distinto al configurado (${ivaRate}); se usa el configurado.`);
    }

    // Promociones "Compra X, paga Y" (2x1, 3x2...). Los % y monto fijo ya vienen en el
    // precio unitario (resolveServerUnitPrice). Misma lógica que el POS (promotionEngine).
    const buyXPayYPromotions = await Promotion.find({ clientId, estado: 'Activa', tipo: 'BUY_X_PAY_Y' });
    const { discount: promotionDiscountRaw, details: promotionDetails } = computeBuyXPayYDiscounts(
      processedItems.map(i => ({
        producto_id: i.producto_id.toString(),
        producto_nombre: i.producto_nombre,
        cantidad: i.cantidad,
        precio: i.precio,
        isCombo: i.isCombo
      })),
      buyXPayYPromotions,
      new Date()
    );
    const promotionDiscount = Math.min(round2(promotionDiscountRaw), round2(subtotal));

    // Totales finales CON el descuento de promociones (antes se calculaban pero no se guardaban)
    const adjustedSubtotal = round2(subtotal - promotionDiscount);
    const adjustedImpuestos = round2(adjustedSubtotal * ivaRate);
    const adjustedTotal = round2(adjustedSubtotal + adjustedImpuestos);

    // Nota: los productos "gratis" ya están en la cantidad del carrito y su stock ya se
    // contó arriba; antes se volvían a descontar (doble descuento de inventario).

    // Lógica de almacén POR CLIENTE
    // La pantalla de configuración guarda 'permitir_stock_negativo'; 'allow_negative_stock' es la clave vieja
    const configRow = await Config.findOne({ clave: 'permitir_stock_negativo', clientId })
      || await Config.findOne({ clave: 'allow_negative_stock', clientId });
    const allowNegativeStock = configRow ? (configRow.valor === '1' || configRow.valor === 'true') : false;
    
    const ingredientNeeds = {};

    // Optimización: Obtener todas las personalizaciones en una sola query
    const allPersonalizationIds = [];
    items.forEach(item => {
      if (item.personalizaciones) {
        let opciones = [];
        if (Array.isArray(item.personalizaciones)) {
          opciones = item.personalizaciones;
        } else if (typeof item.personalizaciones === 'object') {
          opciones = Object.values(item.personalizaciones).flat();
        }
        opciones.forEach(op => {
          if (op?.id) allPersonalizationIds.push(op.id);
        });
      }
    });
    
    const personalizations = allPersonalizationIds.length > 0 
      ? await Personalization.find({ _id: { $in: allPersonalizationIds }, activo: true, clientId })
      : [];
    const personalizationsMap = new Map(personalizations.map(p => [p._id.toString(), p]));

    // Optimización: Obtener todas las recetas de personalizaciones en una sola aggregation
    const customRecipes = allPersonalizationIds.length > 0
      ? await RecipePersonalization.aggregate([
          { $match: { personalizacion_id: { $in: allPersonalizationIds.map(id => mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id) }, clientId: new mongoose.Types.ObjectId(clientId) }},
          { $lookup: { from: 'ingredients', localField: 'ingrediente_id', foreignField: '_id', as: 'ingrediente' }},
          { $unwind: '$ingrediente' },
          { $match: { 'ingrediente.activo': true }},
          { $project: { personalizacion_id: 1, ingrediente_id: 1, cantidad: 1, nombre: '$ingrediente.nombre', unidad_medida: '$ingrediente.unidad_medida' }}
        ])
      : [];
    const customRecipesMap = new Map();
    customRecipes.forEach(cr => {
      const key = cr.personalizacion_id.toString();
      if (!customRecipesMap.has(key)) customRecipesMap.set(key, []);
      customRecipesMap.get(key).push(cr);
    });

    for (const item of processedItems) {
      // Si es un combo, descomponer en cada producto participante y aplicar sus recetas
      const itemsToApplyRecipes = [];
      if (item.isCombo && item.comboData) {
        for (const pc of (item.comboData.productosCombo || [])) {
          itemsToApplyRecipes.push({
            producto_id: pc.producto_id,
            cantidad: (pc.cantidad || 1) * item.cantidad,
            personalizaciones: null
          });
        }
      } else {
        itemsToApplyRecipes.push(item);
      }

      for (const subItem of itemsToApplyRecipes) {
        const qty = subItem.cantidad;
        
        // Obtener la receta base del producto (usando el mapa de recetas)
        const productRecipes = recipesMap.get(subItem.producto_id.toString()) || [];
        const baseRecipe = await Recipe.aggregate([
          { $match: { _id: { $in: productRecipes.map(r => r._id) } }},
          { $lookup: { from: 'ingredients', localField: 'ingrediente_id', foreignField: '_id', as: 'ingrediente' }},
          { $unwind: '$ingrediente' },
          { $match: { 'ingrediente.activo': true, 'ingrediente.clientId': new mongoose.Types.ObjectId(clientId) }},
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

        if (subItem.personalizaciones) {
          // processedItems guarda las personalizaciones como texto JSON; antes no se leían
          // y nunca se reemplazaba el ingrediente (ej. leche normal -> leche de avena)
          let persObj = subItem.personalizaciones;
          if (typeof persObj === 'string') {
            try { persObj = JSON.parse(persObj); } catch { persObj = null; }
          }
          const opcionesSeleccionadas = extractSelectedOptions(persObj);

          for (const opcion of opcionesSeleccionadas) {
            if (!opcion?.id) continue;
            
            // Obtener la personalización del mapa (bulk fetch)
            const customDb = personalizationsMap.get(opcion.id.toString());
            if (customDb && customDb.tipo) {
              categoriesToReplace.add(customDb.tipo);
            }

            // Obtener la receta de la personalización del mapa (bulk fetch)
            const custRecipes = customRecipesMap.get(opcion.id.toString()) || [];
            customRecipesToApply.push(...custRecipes);
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
    }
    
    // Verificar disponibilidad de ingredientes y productos
    const faltantes = [];
    for (const [ingId, need] of Object.entries(ingredientNeeds)) {
      if (need.cantidad <= 0) continue;
      const ingRow = await Ingredient.findOne({ _id: ingId, clientId });
      if (ingRow && ingRow.stock_actual < need.cantidad && !allowNegativeStock) {
        faltantes.push(`${need.nombre} (tiene ${ingRow.stock_actual}${need.unidad_medida}, necesita ${need.cantidad}${need.unidad_medida})`);
      }
      // Si el ingrediente está en 0 o por debajo de mínimo, no bloqueamos pero se avisará después si la venta pasa
    }
    // Verificar stock de productos sin receta
    for (const [pid, need] of Object.entries(productStockNeeds)) {
      const prod = need.product;
      if (!prod) continue;
      if (prod.stock !== undefined && prod.stock !== null && prod.stock < need.cantidad && !allowNegativeStock) {
        faltantes.push(`${prod.nombre} (producto sin receta: tiene ${prod.stock}, necesita ${need.cantidad})`);
      }
    }
    if (faltantes.length > 0) {
      const err = new Error(`Stock insuficiente para procesar la venta. Faltantes:\n${faltantes.join('\n')}`);
      err.code = 'INSUFFICIENT_STOCK';
      err.faltantes = faltantes;
      throw err;
    }
    
    // Descontar stocks (dentro de la transacción)
    for (const [ingId, need] of Object.entries(ingredientNeeds)) {
      if (need.cantidad <= 0) continue;
      await Ingredient.findOneAndUpdate({ _id: ingId, clientId }, { $inc: { stock_actual: -need.cantidad } }, { session });
    }
    for (const [pid, need] of Object.entries(productStockNeeds)) {
      if (need.cantidad <= 0) continue;
      await Product.findByIdAndUpdate(pid, { $inc: { stock: -need.cantidad } }, { session });
    }

    // Manejar pagos en dólar y guardar tipoCambio del sistema para todos los tickets
    let systemTipoCambio = 20.00;
    try {
      const tcRow = await Config.findOne({ clave: 'tipo_cambio_dolar', clientId });
      if (tcRow && tcRow.valor) systemTipoCambio = parseFloat(tcRow.valor);
    } catch {}
    let tipoCambio = systemTipoCambio;
    let montoDolar = null;
    let dolarRecibido = null;
    let cambioPesos = null;
    let efectivoMxn = 0;
    let efectivoUsd = 0;
    let tarjetaCredito = 0;
    let tarjetaDebito = 0;

    if (metodo_pago === 'dolar') {
      tipoCambio = saleData.tipo_cambio ? parseFloat(saleData.tipo_cambio) : systemTipoCambio;
      montoDolar = Number((adjustedTotal / tipoCambio).toFixed(2));
      dolarRecibido = saleData.dolar_recibido || montoDolar;
      cambioPesos = Number(((dolarRecibido - montoDolar) * tipoCambio).toFixed(2));
    } else if (metodo_pago === 'mixto') {
      tipoCambio = saleData.tipo_cambio ? parseFloat(saleData.tipo_cambio) : systemTipoCambio;
      efectivoMxn = saleData.efectivo_mxn || 0;
      efectivoUsd = saleData.efectivo_usd || 0;
      tarjetaCredito = saleData.tarjeta_credito || 0;
      tarjetaDebito = saleData.tarjeta_debito || 0;
      cambioPesos = saleData.cambio_pesos || 0;
    }

    // Generar número de venta secuencial POR CLIENTE
    // Número de venta secuencial POR CLIENTE, atómico (sin duplicados con ventas simultáneas)
    const nextNumeroVenta = await nextSequence(clientId, 'numero_venta', async () => {
      const lastSale = await Sale.findOne({ clientId }).sort({ numero_venta: -1 }).select('numero_venta');
      return lastSale?.numero_venta || 0;
    });

    // Obtener configuración de idioma y moneda del cliente
    const configIdioma = await Config.findOne({ clave: 'idioma', clientId });
    const configMoneda = await Config.findOne({ clave: 'moneda_predeterminada', clientId });
    const idioma = configIdioma?.valor || 'es';
    const monedaPredeterminada = configMoneda?.valor || 'MXN';

    const newSale = await Sale.create([{
      clientId,
      numero_venta: nextNumeroVenta,
      subtotal: adjustedSubtotal,
      impuestos: adjustedImpuestos,
      total: adjustedTotal,
      descuento_promociones: promotionDiscount,
      promociones_aplicadas: promotionDetails,
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
      iva_rate: ivaRate,
      idioma,
      moneda_predeterminada: monedaPredeterminada
    }], { session });

    const ventaId = newSale[0]._id;

    // Insertar detalles (optimizado: usar productos ya obtenidos)
    for (const item of processedItems) {
      const product = productsMap.get(item.producto_id.toString());
      const descuento = product ? (product.descuento || 0) : 0;

      // Buscar si este item tiene promoción aplicada o es combo
      let itemPromotion = null;
      if (item.isCombo && item.comboData) {
        itemPromotion = {
          promocion_id: item.comboData._id,
          promocion_nombre: item.comboData.nombre,
          promocion_tipo: 'COMBO'
        };
      } else {
        for (const pd of promotionDetails) {
          if (pd.freeItems && pd.freeItems.some(fi => fi.producto_id.toString() === item.producto_id.toString())) {
            itemPromotion = {
              promocion_id: pd.promocion_id,
              promocion_nombre: pd.nombre,
              promocion_tipo: pd.tipo
            };
            break;
          }
        }
      }

      await SaleDetail.create([{
        clientId,
        venta_id: ventaId,
        producto_id: item.producto_id,
        producto_nombre: item.producto_nombre,
        cantidad: item.cantidad,
        precio: item.precio,
        importe: item.importe,
        personalizaciones: item.personalizaciones,
        descuento,
        ...itemPromotion
      }], { session });
    }

    // Registrar log
    await logAction(usuarioId, 'CREAR_VENTA', `Venta creada: Total: $${adjustedTotal.toFixed(2)}`);

    await session.commitTransaction();

    const result = await getSaleById(ventaId);
    result.iva_rate = ivaRate;

    // --- Alertas de stock bajo tras la venta (no bloqueante) - solo verdaderas ---
    try {
      const ingredientesBajos = await Ingredient.find({ clientId, activo: true });
      const bajosIng = ingredientesBajos
        .filter(i => i.stock_minimo > 0 && i.stock_actual <= i.stock_minimo)
        .map(i => ({
          nombre: i.nombre,
          stock_actual: i.stock_actual,
          stock_minimo: i.stock_minimo,
          unidad_medida: i.unidad_medida,
          tipo: 'ingrediente',
          agotado: i.stock_actual <= 0
        }));
      // productos bajos: solo los vendidos en esta venta Y sin receta (los con receta dependen de ingredientes)
      const prodIdsAfectados = [...new Set(items.map(it => it.producto_id.toString()))];
      const productosAfectados = await Product.find({ _id: { $in: prodIdsAfectados }, clientId });
      // ids de productos que tienen receta
      const prodIdsConReceta = new Set((await Recipe.distinct('producto_id', { clientId: new mongoose.Types.ObjectId(clientId) })).map(id => id.toString()));
      const bajosProd = productosAfectados
        .filter(p => !prodIdsConReceta.has(p._id.toString()))
        .filter(p => p.stock !== undefined && p.stock !== null && p.stock <= (p.stock_minimo ?? 5))
        .map(p => ({
          nombre: p.nombre,
          stock: p.stock,
          stock_minimo: p.stock_minimo ?? 5,
          tipo: 'producto',
          agotado: p.stock <= 0
        }));
      const warnings = [...bajosIng, ...bajosProd];
      if (warnings.length > 0) {
        result.stockAlertas = warnings;
        result.hasStockAlertas = true;
      }
    } catch (e) {
      console.warn('Error generando alertas de stock post-venta:', e.message);
    }

    return result;
  } catch (error) {
    if (session) {
      try { await session.abortTransaction(); } catch {}
    }
    throw error;
  } finally {
    if (session) {
      try { session.endSession(); } catch {}
    }
  }
}

/**
 * Regresa al inventario lo que descontó una venta (misma lógica que createSale):
 * - Ingredientes de la receta base (omitiendo los reemplazados por la personalización elegida)
 * - Ingredientes de las personalizaciones
 * - Stock de productos sin receta
 * - Combos: se desglosan en sus productos
 * Nota: usa las recetas actuales (si la receta cambió desde la venta, se regresa con la nueva).
 */
async function restoreStockForSale(saleId, clientId) {
  const clientObjectId = new mongoose.Types.ObjectId(String(clientId));
  const details = await SaleDetail.find({ venta_id: saleId, clientId: clientObjectId }).lean();

  // 1) Desglosar en unidades de producto
  const units = [];
  for (const d of details) {
    if (!d.producto_id) continue;
    let personalizaciones = null;
    if (d.personalizaciones) {
      try { personalizaciones = JSON.parse(d.personalizaciones); } catch { personalizaciones = null; }
    }
    if (d.promocion_tipo === 'COMBO' || personalizaciones?.isCombo) {
      const combo = await Promotion.findOne({ _id: d.producto_id, clientId: clientObjectId }).lean();
      if (!combo) {
        console.warn(`[restoreStock] Combo ${d.producto_id} no encontrado; no se regresa su stock`);
        continue;
      }
      for (const pc of combo.productosCombo || []) {
        units.push({ producto_id: String(pc.producto_id), cantidad: (pc.cantidad || 1) * d.cantidad, personalizaciones: null });
      }
    } else {
      units.push({ producto_id: String(d.producto_id), cantidad: d.cantidad, personalizaciones });
    }
  }
  if (units.length === 0) return;

  const productIds = [...new Set(units.map(u => u.producto_id))].map(id => new mongoose.Types.ObjectId(id));

  // 2) Recetas base con datos del ingrediente (para categoria_reemplazo)
  const baseRecipes = await Recipe.aggregate([
    { $match: { producto_id: { $in: productIds }, clientId: clientObjectId } },
    { $lookup: { from: 'ingredients', localField: 'ingrediente_id', foreignField: '_id', as: 'ingrediente' } },
    { $unwind: '$ingrediente' },
    { $match: { 'ingrediente.clientId': clientObjectId } },
    { $project: { producto_id: 1, ingrediente_id: 1, cantidad: 1, categoria_reemplazo: '$ingrediente.categoria_reemplazo' } }
  ]);
  const recipesByProduct = new Map();
  for (const r of baseRecipes) {
    const key = r.producto_id.toString();
    if (!recipesByProduct.has(key)) recipesByProduct.set(key, []);
    recipesByProduct.get(key).push(r);
  }

  // 3) Personalizaciones elegidas y sus recetas
  const optionIds = [];
  for (const u of units) {
    for (const op of extractSelectedOptions(u.personalizaciones)) {
      if (op?.id && mongoose.Types.ObjectId.isValid(String(op.id))) optionIds.push(new mongoose.Types.ObjectId(String(op.id)));
    }
  }
  const personalizations = optionIds.length > 0
    ? await Personalization.find({ _id: { $in: optionIds }, clientId: clientObjectId }).lean()
    : [];
  const personalizationMap = new Map(personalizations.map(p => [p._id.toString(), p]));
  const persRecipes = optionIds.length > 0
    ? await RecipePersonalization.find({ personalizacion_id: { $in: optionIds }, clientId: clientObjectId }).lean()
    : [];
  const persRecipesMap = new Map();
  for (const r of persRecipes) {
    const key = r.personalizacion_id.toString();
    if (!persRecipesMap.has(key)) persRecipesMap.set(key, []);
    persRecipesMap.get(key).push(r);
  }

  // 4) Acumular lo que hay que regresar
  const ingredientReturns = new Map();
  const productReturns = new Map();
  const addIng = (id, qty) => ingredientReturns.set(id.toString(), (ingredientReturns.get(id.toString()) || 0) + qty);

  for (const u of units) {
    const recipe = recipesByProduct.get(u.producto_id) || [];
    if (recipe.length === 0) {
      productReturns.set(u.producto_id, (productReturns.get(u.producto_id) || 0) + u.cantidad);
      continue;
    }
    const options = extractSelectedOptions(u.personalizaciones).filter(op => op?.id);
    const replacedCategories = new Set(
      options.map(op => personalizationMap.get(String(op.id))?.tipo).filter(Boolean)
    );
    for (const r of recipe) {
      if (r.categoria_reemplazo && replacedCategories.has(r.categoria_reemplazo)) continue;
      addIng(r.ingrediente_id, r.cantidad * u.cantidad);
    }
    for (const op of options) {
      for (const r of persRecipesMap.get(String(op.id)) || []) {
        addIng(r.ingrediente_id, r.cantidad * u.cantidad);
      }
    }
  }

  // 5) Aplicar
  for (const [ingId, qty] of ingredientReturns) {
    if (qty > 0) await Ingredient.updateOne({ _id: ingId, clientId: clientObjectId }, { $inc: { stock_actual: qty } });
  }
  for (const [prodId, qty] of productReturns) {
    if (qty > 0) await Product.updateOne({ _id: prodId, clientId: clientObjectId }, { $inc: { stock: qty } });
  }
}

/**
 * Cancela una venta (marca como cancelada) y regresa el stock
 * @param {string} id - ID de la venta
 * @param {string} usuarioId - ID del usuario que cancela
 */
export async function cancelSale(id, usuarioId = null) {
  try {
    // Marcado atómico: solo una petición puede cancelarla
    const previous = await Sale.findOneAndUpdate(
      { _id: id, cancelada: { $ne: true } },
      { cancelada: true },
      { new: false }
    );

    if (!previous) {
      const exists = await Sale.exists({ _id: id });
      throw new Error(exists ? 'La venta ya fue cancelada' : 'Venta no encontrada');
    }

    // Si ya estaba devuelta, su stock ya se regresó en la devolución
    if (!previous.devuelta) {
      try {
        await restoreStockForSale(previous._id, previous.clientId);
      } catch (e) {
        console.error(`[cancelSale] Venta ${id} cancelada pero falló regresar stock:`, e.message);
      }
    }

    await logAction(usuarioId, 'CANCELAR_VENTA', `Venta #${previous.numero_venta} cancelada: Total: $${previous.total}`);
  } catch (error) {
    console.error('Error al cancelar venta:', error.message);
    throw error;
  }
}

// ---------------- Fechas en la zona horaria del negocio ----------------

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Inicio del día (00:00 Tijuana) de una fecha 'YYYY-MM-DD', como Date UTC */
function businessDayStart(dateStr) {
  if (DATE_ONLY.test(String(dateStr))) return fromZonedTime(`${dateStr}T00:00:00.000`, BUSINESS_TIMEZONE);
  return new Date(dateStr);
}

/** Fin del día (23:59:59.999 Tijuana) de una fecha 'YYYY-MM-DD', como Date UTC */
function businessDayEnd(dateStr) {
  if (DATE_ONLY.test(String(dateStr))) return fromZonedTime(`${dateStr}T23:59:59.999`, BUSINESS_TIMEZONE);
  return new Date(dateStr);
}

function businessToday() {
  return formatInTimeZone(new Date(), BUSINESS_TIMEZONE, 'yyyy-MM-dd');
}

function buildUserFilter(usuarioId) {
  if (!usuarioId) return null;
  return mongoose.Types.ObjectId.isValid(usuarioId) ? new mongoose.Types.ObjectId(usuarioId) : usuarioId;
}

/**
 * Obtiene las ventas de un día específico (día en hora de Tijuana)
 * @param {string} date - Fecha en formato YYYY-MM-DD
 * @param {string|null} usuarioId - Filtrar por vendedor
 * @returns {Array} Lista de ventas del día
 */
export async function getSalesByDate(date, usuarioId = null, clientId = null) {
  try {
    const query = {
      fecha: { $gte: businessDayStart(date), $lte: businessDayEnd(date) },
      cancelada: { $ne: true }
    };

    const userFilter = buildUserFilter(usuarioId);
    if (userFilter) query.usuario_id = userFilter;
    if (clientId) query.clientId = clientId;

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
 * Obtiene el resumen de ventas de un día (hora de Tijuana), sin canceladas ni devueltas
 * @param {string} date - Fecha en formato YYYY-MM-DD
 * @returns {Object} Resumen de ventas
 */
export async function getDailySummary(date, clientId) {
  try {
    if (!clientId) {
      throw new Error('clientId es requerido para el resumen diario');
    }

    const summary = await Sale.aggregate([
      { $match: {
        clientId: new mongoose.Types.ObjectId(clientId),
        fecha: { $gte: businessDayStart(date), $lte: businessDayEnd(date) },
        cancelada: { $ne: true },
        devuelta: { $ne: true }
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
 * Obtiene las ventas de un rango de fechas (días en hora de Tijuana, inclusivo)
 * @param {string} startDate - Fecha inicio YYYY-MM-DD
 * @param {string} endDate - Fecha fin YYYY-MM-DD
 * @param {string|null} usuarioId - Filtrar por vendedor
 * @returns {Array} Lista de ventas en el rango
 */
export async function getSalesByDateRange(startDate, endDate, usuarioId = null, clientId = null) {
  try {
    const query = {
      fecha: { $gte: businessDayStart(startDate), $lte: businessDayEnd(endDate) },
      cancelada: { $ne: true }
    };

    const userFilter = buildUserFilter(usuarioId);
    if (userFilter) query.usuario_id = userFilter;
    if (clientId) query.clientId = clientId;

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
    const obj = detail.toObject();
    let personalizaciones = null;
    if (detail.personalizaciones) {
      try { personalizaciones = JSON.parse(detail.personalizaciones); } catch { personalizaciones = detail.personalizaciones; }
    }
    bySale[detail.venta_id].push({
      ...obj,
      producto_nombre: obj.producto_nombre || obj.promocion_nombre || obj.producto_id?.nombre || 'Producto',
      personalizaciones
    });
  }

  return sales.map(sale => ({
    ...sale.toObject(),
    detalles: bySale[sale._id] || []
  }));
}

/**
 * Obtiene KPIs de ventas con filtros por período o año específico.
 * Todas las fechas, horas, días y meses se calculan en hora de Tijuana.
 * No cuenta ventas canceladas ni devueltas.
 * @param {string} period - 'day', 'week', 'month', 'year'
 * @param {string} startDate - Fecha inicio YYYY-MM-DD (opcional)
 * @param {string} endDate - Fecha fin YYYY-MM-DD (opcional)
 * @param {string|number} selectedYear - Año específico (opcional)
 * @returns {Object} KPIs de ventas
 */
export async function getSalesKPIs(period = 'day', startDate = null, endDate = null, selectedYear = null, clientId = null) {
  try {
    let dateFilter = {};
    const today = businessToday();
    const [cy, cm] = today.split('-').map(Number);
    const yearNum = selectedYear ? parseInt(selectedYear, 10) : NaN;

    if (Number.isFinite(yearNum) && yearNum > 1900) {
      // Antes: selectedYear + 1 concatenaba texto ("2025" + 1 = "20251")
      dateFilter = {
        $gte: businessDayStart(`${yearNum}-01-01`),
        $lte: businessDayEnd(`${yearNum}-12-31`)
      };
    } else if (startDate && endDate) {
      dateFilter = {
        $gte: businessDayStart(startDate),
        $lte: businessDayEnd(endDate)
      };
    } else {
      switch (period) {
        case 'week': {
          const weekAgo = formatInTimeZone(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), BUSINESS_TIMEZONE, 'yyyy-MM-dd');
          dateFilter = { $gte: businessDayStart(weekAgo), $lte: businessDayEnd(today) };
          break;
        }
        case 'month': {
          // Antes excluía el último día del mes
          const lastDay = new Date(Date.UTC(cy, cm, 0)).getUTCDate();
          const mm = String(cm).padStart(2, '0');
          dateFilter = {
            $gte: businessDayStart(`${cy}-${mm}-01`),
            $lte: businessDayEnd(`${cy}-${mm}-${String(lastDay).padStart(2, '0')}`)
          };
          break;
        }
        case 'year':
          dateFilter = {
            $gte: businessDayStart(`${cy}-01-01`),
            $lte: businessDayEnd(`${cy}-12-31`)
          };
          break;
        case 'day':
        default:
          dateFilter = { $gte: businessDayStart(today), $lte: businessDayEnd(today) };
      }
    }

    const baseMatch = { cancelada: { $ne: true }, devuelta: { $ne: true } };
    if (clientId) baseMatch.clientId = new mongoose.Types.ObjectId(clientId);
    const matchQuery = { ...baseMatch, fecha: dateFilter };
    const tz = BUSINESS_TIMEZONE;

    // Años disponibles (de todas las ventas de la cafetería, no solo del filtro actual)
    const availableYears = await Sale.aggregate([
      { $match: baseMatch },
      { $group: { _id: { $year: { date: '$fecha', timezone: tz } } } },
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
      }},
      { $project: { _id: 0, metodo_pago: '$_id.metodo_pago', tipo_tarjeta: '$_id.tipo_tarjeta', cantidad: 1, total: 1 } },
      { $sort: { total: -1 } }
    ]);

    // Ventas por hora (hora local del negocio)
    const hourlySalesRaw = await Sale.aggregate([
      { $match: matchQuery },
      { $group: {
        _id: { $hour: { date: '$fecha', timezone: tz } },
        cantidad_ventas: { $sum: 1 },
        total_ventas: { $sum: '$total' }
      }},
      { $sort: { _id: 1 } }
    ]);
    const hourlySales = hourlySalesRaw.map(h => ({
      hora: h._id,
      cantidad_ventas: h.cantidad_ventas,
      total_ventas: h.total_ventas
    }));

    // Productos más vendidos (incluye combos por su nombre)
    const topProductsMatch = { 'venta.fecha': dateFilter, 'venta.cancelada': { $ne: true }, 'venta.devuelta': { $ne: true } };
    const detailMatch = clientId ? { clientId: new mongoose.Types.ObjectId(clientId) } : {};
    if (clientId) topProductsMatch['venta.clientId'] = new mongoose.Types.ObjectId(clientId);
    const topProducts = await SaleDetail.aggregate([
      { $match: detailMatch },
      { $lookup: { from: 'sales', localField: 'venta_id', foreignField: '_id', as: 'venta' }},
      { $unwind: '$venta' },
      { $match: topProductsMatch },
      { $group: {
        _id: '$producto_id',
        nombre_guardado: { $last: '$producto_nombre' },
        cantidad_vendida: { $sum: '$cantidad' },
        total_ingresos: { $sum: '$importe' }
      }},
      { $sort: { cantidad_vendida: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'producto' }},
      { $project: {
        producto_nombre: { $ifNull: [{ $arrayElemAt: ['$producto.nombre', 0] }, '$nombre_guardado'] },
        cantidad_vendida: 1,
        total_ingresos: 1
      }}
    ]);

    // Ventas por día (día local del negocio)
    const dailySalesRaw = await Sale.aggregate([
      { $match: matchQuery },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$fecha', timezone: tz } },
        cantidad_ventas: { $sum: 1 },
        total_ventas: { $sum: '$total' }
      }},
      { $sort: { _id: 1 } }
    ]);
    const dailySales = dailySalesRaw.map(d => ({
      fecha: d._id,
      cantidad_ventas: d.cantidad_ventas,
      total_ventas: d.total_ventas
    }));

    // Ventas por mes (mes local del negocio)
    const monthlySales = await Sale.aggregate([
      { $match: matchQuery },
      { $group: {
        _id: { $month: { date: '$fecha', timezone: tz } },
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
 * Devuelve una venta y regresa el stock
 * @param {string} saleId - ID de la venta a devolver
 * @param {string} userId - ID del usuario que realiza la devolución
 * @param {string} motivo - Motivo de la devolución
 */
export async function refundSale(saleId, userId, motivo = '', clientIdParam = null) {
  try {
    const filter = { _id: saleId, devuelta: { $ne: true }, cancelada: { $ne: true } };
    if (clientIdParam) filter.clientId = clientIdParam;

    // Marcado atómico: evita devolver dos veces la misma venta (y regresar stock doble)
    const sale = await Sale.findOneAndUpdate(
      filter,
      { devuelta: true, motivo_devolucion: motivo || 'Devolución solicitada' },
      { new: true }
    );

    if (!sale) {
      const existing = await Sale.findById(saleId).select('devuelta cancelada');
      if (!existing) throw new Error('Venta no encontrada');
      if (existing.cancelada) throw new Error('La venta está cancelada');
      throw new Error('La venta ya está devuelta');
    }

    // Registro informativo en la caja (el corte ya excluye las ventas devueltas)
    if (sale.caja_id) {
      await CashRegister.updateOne({ _id: sale.caja_id }, { $inc: { total_devoluciones: sale.total } });
    }

    try {
      await restoreStockForSale(sale._id, sale.clientId);
    } catch (e) {
      console.error(`[refundSale] Venta ${saleId} devuelta pero falló regresar stock:`, e.message);
    }

    await logAction(userId, 'DEVOLUCION_VENTA', `Venta #${sale.numero_venta} devuelta: Total: $${sale.total}, Motivo: ${motivo}`);

    return await getSaleById(saleId);
  } catch (error) {
    console.error('Error al devolver venta:', error);
    throw error;
  }
}
