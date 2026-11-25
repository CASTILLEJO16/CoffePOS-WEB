/**
 * Lógica central del programa de lealtad (sellos y recompensas).
 *
 * Flujo pensado para que sea rápido en caja:
 *   1. El cliente muestra su QR (impreso, en pantalla o en Google Wallet).
 *   2. El cajero lo escanea en el POS (lector USB o cámara).
 *   3. Al cobrar, la venta otorga el sello automáticamente (stampCardForSale).
 *
 * Reglas:
 *   - 1 venta = 1 sello (nunca dos sellos por la misma venta).
 *   - Al completar los sellos requeridos se gana 1 recompensa y la tarjeta
 *     empieza un ciclo nuevo en 0: el cliente sigue juntando sellos aunque
 *     todavía no canjee la recompensa.
 *   - Cancelar o reembolsar la venta revierte su sello (revertStampForSale).
 */

import mongoose from 'mongoose';
import LoyaltyCard from '../models/LoyaltyCard.js';
import StampHistory from '../models/StampHistory.js';
import Sale from '../models/Sale.js';
import Config from '../models/Config.js';
import Reward from '../models/Reward.js';
import {
  MAIN_REWARD_KEY,
  getAvailableRewards,
  computeRewardDiscount,
  normalizeTiers,
  round2
} from '../utils/loyaltyRewards.js';
import { syncGoogleCard } from './googleWalletService.js';

/** Error de negocio: el controlador lo responde como 4xx con su mensaje (no 500). */
export class LoyaltyError extends Error {
  constructor(message, status = 400, code = 'LOYALTY_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Extrae el token de lo que haya leído el escáner.
 * El QR contiene el token (32 caracteres hex), pero toleramos espacios, mayúsculas
 * o que venga dentro de una URL.
 */
export function normalizeQrToken(raw) {
  const text = String(raw ?? '').trim();
  const match = text.match(/[a-f0-9]{32}/i);
  return match ? match[0].toLowerCase() : null;
}

async function getLoyaltySettings(clientId) {
  const rows = await Config.find({
    clientId,
    clave: { $in: ['loyalty_enabled', 'loyalty_min_purchase'] }
  }).lean();
  const map = Object.fromEntries(rows.map(r => [r.clave, r.valor]));
  return {
    // Si nunca se configuró, el programa se considera activo (comportamiento previo)
    enabled: map.loyalty_enabled === undefined ? true : map.loyalty_enabled === 'true',
    minPurchase: parseFloat(map.loyalty_min_purchase) || 0
  };
}

/** Busca una tarjeta de la cafetería por token o por id. */
export async function findCard({ clientId, qrToken, cardId }) {
  if (cardId) {
    if (!mongoose.Types.ObjectId.isValid(String(cardId))) return null;
    return LoyaltyCard.findOne({ _id: cardId, clientId }).populate('customerId');
  }
  const token = normalizeQrToken(qrToken);
  if (!token) return null;
  return LoyaltyCard.findOne({ qr_token: token, clientId }).populate('customerId');
}

/**
 * Resuelve una venta a partir de lo que escriba el cajero: el número de venta
 * del ticket (ej. "130" o "#130") o el id interno.
 */
export async function findSaleForStamp(clientId, saleRef) {
  const ref = String(saleRef ?? '').trim().replace(/^#/, '');
  if (!ref) return null;
  if (/^\d+$/.test(ref)) {
    return Sale.findOne({ clientId, numero_venta: Number(ref) });
  }
  if (mongoose.Types.ObjectId.isValid(ref)) {
    return Sale.findOne({ clientId, _id: ref });
  }
  return null;
}

function cardSummary(card) {
  const customer = card.customerId && card.customerId.nombre ? card.customerId : null;
  return {
    cardId: card._id,
    qr_token: card.qr_token,
    nombre: customer?.nombre || 'Cliente',
    telefono: customer?.telefono || null,
    sellos_actuales: card.sellos_actuales,
    sellos_requeridos: card.sellos_requeridos,
    recompensas_disponibles: card.recompensas_disponibles,
    ciclo_actual: card.ciclo_actual,
    estado: card.estado,
    niveles_usados: card.niveles_usados || []
  };
}

/**
 * Otorga el sello de una venta a una tarjeta.
 * @returns {{stamped: true, rewardUnlocked: boolean, card: object, message: string}}
 * @throws {LoyaltyError} si no procede (tarjeta inválida, venta ya sellada, etc.)
 */
export async function stampCardForSale({ clientId, sale, qrToken, cardId, empleadoId }) {
  if (!clientId) throw new LoyaltyError('Usuario sin cafetería asignada');
  if (!sale) throw new LoyaltyError('Venta no encontrada', 404, 'SALE_NOT_FOUND');
  if (sale.cancelada || sale.devuelta) {
    throw new LoyaltyError('La venta está cancelada o devuelta', 400, 'SALE_CANCELLED');
  }

  const settings = await getLoyaltySettings(clientId);
  if (!settings.enabled) {
    throw new LoyaltyError('El programa de lealtad está desactivado', 400, 'LOYALTY_DISABLED');
  }
  if (settings.minPurchase > 0 && Number(sale.total) < settings.minPurchase) {
    throw new LoyaltyError(
      `La compra mínima para sello es $${settings.minPurchase.toFixed(2)}`,
      400,
      'MIN_PURCHASE'
    );
  }

  const card = await findCard({ clientId, qrToken, cardId });
  if (!card) throw new LoyaltyError('Tarjeta no encontrada', 404, 'CARD_NOT_FOUND');
  if (card.estado !== 'activa') {
    throw new LoyaltyError(`La tarjeta está ${card.estado}`, 400, 'CARD_INACTIVE');
  }

  const session = await LoyaltyCard.startSession();
  let rewardUnlocked = false;
  try {
    await session.withTransaction(async () => {
      rewardUnlocked = false;
      const already = await StampHistory.findOne(
        { clientId, venta_id: sale._id, tipo: 'otorgado' },
        null,
        { session }
      );
      if (already) {
        // ¿Se revirtió después? Entonces se puede volver a sellar.
        const reverted = await StampHistory.countDocuments(
          { clientId, venta_id: sale._id, tipo: 'revertido' },
          { session }
        );
        const granted = await StampHistory.countDocuments(
          { clientId, venta_id: sale._id, tipo: 'otorgado' },
          { session }
        );
        if (granted > reverted) {
          throw new LoyaltyError(`La venta #${sale.numero_venta} ya generó un sello`, 400, 'ALREADY_STAMPED');
        }
      }

      const fresh = await LoyaltyCard.findById(card._id).session(session);
      // Tarjetas antiguas quedaban "llenas" esperando canje: empezar ciclo nuevo
      if (fresh.sellos_actuales >= fresh.sellos_requeridos) {
        fresh.sellos_actuales = 0;
        fresh.ciclo_actual += 1;
        fresh.niveles_usados = [];
      }
      fresh.sellos_actuales += 1;
      const numeroSello = fresh.sellos_actuales;

      if (fresh.sellos_actuales >= fresh.sellos_requeridos) {
        fresh.recompensas_disponibles += 1;
        fresh.sellos_actuales = 0;
        fresh.ciclo_actual += 1;
        fresh.niveles_usados = []; // los niveles vuelven a estar disponibles en el ciclo nuevo
        rewardUnlocked = true;
      }
      await fresh.save({ session });

      await StampHistory.create([{
        clientId,
        customerId: fresh.customerId,
        loyaltyCardId: fresh._id,
        venta_id: sale._id,
        empleado_id: empleadoId,
        tipo: 'otorgado',
        numero_sello: numeroSello
      }], { session });

      card.sellos_actuales = fresh.sellos_actuales;
      card.recompensas_disponibles = fresh.recompensas_disponibles;
      card.ciclo_actual = fresh.ciclo_actual;
    });
  } finally {
    await session.endSession();
  }

  syncGoogleCard(card._id); // Reflejar en Google Wallet (no bloquea)

  const summary = cardSummary(card);
  // ¿Este sello desbloqueó un nivel? (ej. "al llegar a 5 sellos: 10% de descuento")
  let tierUnlocked = null;
  try {
    const config = await getProgramConfig(clientId);
    tierUnlocked = config.rewards.find(t => t.stamps === summary.sellos_actuales) || null;
  } catch { /* solo informativo */ }

  let message = `Sello agregado a ${summary.nombre} (${summary.sellos_actuales}/${summary.sellos_requeridos})`;
  if (rewardUnlocked) message = `¡${summary.nombre} completó su tarjeta! Tiene una recompensa disponible.`;
  else if (tierUnlocked) message += ` · ¡Desbloqueó: ${tierUnlocked.description}! Se aplica en su próxima compra.`;
  return {
    stamped: true,
    rewardUnlocked,
    tierUnlocked,
    card: summary,
    message
  };
}

/**
 * Revierte el sello de una venta (al cancelarla o reembolsarla).
 * Devuelve null si la venta no tenía sello vigente. Nunca lanza por "no hay sello".
 */
export async function revertStampForSale({ clientId, saleId, empleadoId, motivo }) {
  if (!clientId || !saleId) return null;

  const session = await LoyaltyCard.startSession();
  let result = null;
  try {
    await session.withTransaction(async () => {
      result = null;
      const granted = await StampHistory.find(
        { clientId, venta_id: saleId, tipo: 'otorgado' },
        null,
        { session }
      ).sort({ fecha: -1 });
      if (granted.length === 0) return;
      const revertedCount = await StampHistory.countDocuments(
        { clientId, venta_id: saleId, tipo: 'revertido' },
        { session }
      );
      if (revertedCount >= granted.length) return; // ya revertido

      const stamp = granted[0];
      const card = await LoyaltyCard.findOne({ _id: stamp.loyaltyCardId, clientId }).session(session);
      if (!card) return;

      if (card.sellos_actuales > 0) {
        card.sellos_actuales -= 1;
      } else if (card.recompensas_disponibles > 0) {
        // Este sello había completado la tarjeta: quitar la recompensa y regresar al ciclo anterior
        card.recompensas_disponibles -= 1;
        card.sellos_actuales = Math.max(0, card.sellos_requeridos - 1);
        card.ciclo_actual = Math.max(1, card.ciclo_actual - 1);
      }
      // Si ya no hay sellos ni recompensa (se canjeó), no se puede quitar más.
      await card.save({ session });

      await StampHistory.create([{
        clientId,
        customerId: stamp.customerId,
        loyaltyCardId: card._id,
        venta_id: saleId,
        empleado_id: empleadoId || stamp.empleado_id,
        tipo: 'revertido',
        numero_sello: stamp.numero_sello,
        motivo_reversion: motivo || 'Venta cancelada/devuelta'
      }], { session });

      result = { cardId: card._id, sellos_actuales: card.sellos_actuales, recompensas_disponibles: card.recompensas_disponibles };
    });
  } finally {
    await session.endSession();
  }

  if (result) syncGoogleCard(result.cardId);
  return result;
}

export { cardSummary };

/**
 * Configuración completa del programa de una cafetería (lo que define el admin).
 */
export async function getProgramConfig(clientId) {
  const rows = await Config.find({ clientId, clave: { $regex: /^loyalty_/ } }).lean();
  const map = Object.fromEntries(rows.map(r => [r.clave, r.valor]));
  let rewards = [];
  try { rewards = JSON.parse(map.loyalty_rewards || '[]'); } catch { rewards = []; }
  const stampsRequired = Math.max(1, parseInt(map.loyalty_stamps_required, 10) || 10);
  return {
    enabled: map.loyalty_enabled === undefined ? true : map.loyalty_enabled === 'true',
    programName: map.loyalty_program_name || 'Programa de Lealtad',
    stampsRequired,
    minPurchase: parseFloat(map.loyalty_min_purchase) || 0,
    rewardProduct: map.loyalty_reward_product || 'Café gratis',
    rewardProductId: map.loyalty_reward_product_id || null,
    rewards: normalizeTiers(rewards, stampsRequired)
  };
}

/** Los niveles se comparan con los sellos requeridos de ESA tarjeta. */
function configForCard(config, card) {
  return { ...config, stampsRequired: card.sellos_requeridos || config.stampsRequired };
}

/**
 * Valida la recompensa que el POS quiere aplicar en una venta y calcula el descuento.
 * Se llama dentro de la transacción de la venta, ANTES de guardarla.
 * @throws {LoyaltyError} si la recompensa no está disponible (la venta no se cobra).
 */
export async function prepareRewardForSale({ clientId, qrToken, rewardKey, items, baseSubtotal, session }) {
  const token = normalizeQrToken(qrToken);
  if (!token) throw new LoyaltyError('Escanea la tarjeta del cliente para aplicar la recompensa', 400, 'REWARD_NO_CARD');
  const card = await LoyaltyCard.findOne({ qr_token: token, clientId }).session(session || null);
  if (!card) throw new LoyaltyError('Tarjeta no encontrada', 404, 'CARD_NOT_FOUND');
  if (card.estado !== 'activa') throw new LoyaltyError(`La tarjeta está ${card.estado}`, 400, 'CARD_INACTIVE');

  const config = await getProgramConfig(clientId);
  if (!config.enabled) throw new LoyaltyError('El programa de lealtad está desactivado', 400, 'LOYALTY_DISABLED');

  const reward = getAvailableRewards(card, configForCard(config, card)).find(r => r.key === rewardKey);
  if (!reward) {
    throw new LoyaltyError('Esa recompensa ya no está disponible para este cliente. Vuelve a escanear la tarjeta.', 400, 'REWARD_UNAVAILABLE');
  }
  if (reward.type === 'manual') {
    throw new LoyaltyError('Esta recompensa se entrega con el botón Canjear', 400, 'REWARD_MANUAL');
  }
  const { amount, reason } = computeRewardDiscount(reward, items, baseSubtotal);
  if (!(amount > 0)) throw new LoyaltyError(reason || 'La recompensa no aplica a esta orden', 400, 'REWARD_NOT_APPLICABLE');
  return { card, reward, amount: round2(amount) };
}

/**
 * Marca la recompensa como usada (misma transacción que la venta).
 * Es condicional: si otra caja la usó al mismo tiempo, falla y la venta no se cobra.
 */
export async function consumeRewardInSale({ clientId, prepared, ventaId, empleadoId, session }) {
  const { card, reward, amount } = prepared;
  let updated;
  if (reward.key === MAIN_REWARD_KEY) {
    updated = await LoyaltyCard.findOneAndUpdate(
      { _id: card._id, clientId, estado: 'activa', recompensas_disponibles: { $gte: 1 } },
      { $inc: { recompensas_disponibles: -1 }, $set: { ultima_recompensa_canjeada: new Date() } },
      { new: true, session }
    );
  } else {
    updated = await LoyaltyCard.findOneAndUpdate(
      { _id: card._id, clientId, estado: 'activa', niveles_usados: { $ne: reward.tierId }, sellos_actuales: { $gte: reward.stamps } },
      { $push: { niveles_usados: reward.tierId }, $set: { ultima_recompensa_canjeada: new Date() } },
      { new: true, session }
    );
  }
  if (!updated) throw new LoyaltyError('Esa recompensa ya se usó. Vuelve a escanear la tarjeta.', 409, 'REWARD_ALREADY_USED');

  await Reward.create([{
    clientId,
    customerId: card.customerId?._id || card.customerId,
    loyaltyCardId: card._id,
    venta_id: ventaId,
    empleado_id: empleadoId,
    producto_recompensa: reward.description,
    producto_id: reward.product_id || undefined,
    ciclo: updated.ciclo_actual,
    clave: reward.key,
    descuento: amount
  }], { session });
  return updated;
}

/**
 * Regresa al cliente la recompensa usada en una venta cancelada/devuelta.
 */
export async function revertRewardForSale({ clientId, saleId }) {
  if (!clientId || !saleId) return null;
  const session = await LoyaltyCard.startSession();
  let result = null;
  try {
    await session.withTransaction(async () => {
      result = null;
      const reward = await Reward.findOneAndUpdate(
        { clientId, venta_id: saleId, revertida: { $ne: true } },
        { $set: { revertida: true } },
        { new: true, session }
      );
      if (!reward) return;
      const card = await LoyaltyCard.findOne({ _id: reward.loyaltyCardId, clientId }).session(session);
      if (!card) return;
      if (!reward.clave || reward.clave === MAIN_REWARD_KEY) {
        card.recompensas_disponibles += 1;
      } else if (reward.ciclo === card.ciclo_actual) {
        // Solo si sigue en el mismo ciclo (si ya empezó otro, los niveles ya se renovaron)
        const id = reward.clave.replace(/^tier:/, '');
        card.niveles_usados = (card.niveles_usados || []).filter(x => x !== id);
      }
      await card.save({ session });
      result = { cardId: card._id };
    });
  } finally {
    await session.endSession();
  }
  if (result) syncGoogleCard(result.cardId);
  return result;
}

/**
 * Canje manual (botón "Canjear"): recompensas sin producto ligado que el cajero entrega a mano.
 */
export async function redeemManualReward({ clientId, cardId, qrToken, rewardKey = MAIN_REWARD_KEY, empleadoId }) {
  const card = await findCard({ clientId, qrToken, cardId });
  if (!card) throw new LoyaltyError('Tarjeta no encontrada', 404);
  if (card.estado !== 'activa') throw new LoyaltyError(`La tarjeta está ${card.estado}`);
  const config = await getProgramConfig(clientId);
  const reward = getAvailableRewards(card, configForCard(config, card)).find(r => r.key === rewardKey);
  if (!reward) throw new LoyaltyError('No hay recompensas disponibles para canjear');
  if (reward.type === 'discount') {
    throw new LoyaltyError('Los descuentos se aplican al cobrar en el POS', 400, 'REWARD_IN_SALE');
  }

  const session = await LoyaltyCard.startSession();
  let updated;
  try {
    await session.withTransaction(async () => {
      updated = await consumeRewardInSale({
        clientId,
        prepared: { card, reward, amount: 0 },
        ventaId: undefined,
        empleadoId,
        session
      });
      // Tarjetas antiguas quedaban "llenas" hasta canjear: empezar ciclo nuevo
      if (reward.key === MAIN_REWARD_KEY && updated.sellos_actuales >= updated.sellos_requeridos) {
        updated.sellos_actuales = 0;
        updated.ciclo_actual += 1;
        updated.niveles_usados = [];
        await updated.save({ session });
      }
    });
  } finally {
    await session.endSession();
  }
  syncGoogleCard(card._id);
  return { card: updated, customer: card.customerId, reward };
}

/** Recompensas disponibles de una tarjeta, listas para mostrarse en el POS. */
export async function availableRewardsForCard(clientId, card) {
  const config = await getProgramConfig(clientId);
  return getAvailableRewards(card, configForCard(config, card));
}
