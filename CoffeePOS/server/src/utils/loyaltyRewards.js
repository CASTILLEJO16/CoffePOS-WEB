/**
 * Reglas de recompensas del programa de lealtad.
 *
 * ⚠️ Este archivo está DUPLICADO en client/src/utils/loyaltyRewards.js.
 *    Deben ser idénticos: el POS muestra el total con esta lógica y el servidor
 *    cobra con esta misma lógica. Si cambias uno, cambia el otro.
 *
 * Tipos de recompensa que configura el admin:
 *   - Niveles (config.rewards): "al llegar a N sellos" →
 *       · discount: X% de descuento en la siguiente compra
 *       · free:     un producto gratis (si se ligó un producto, se descuenta su precio)
 *     Cada nivel se usa una vez por ciclo de sellos.
 *   - Recompensa principal: al completar la tarjeta (stampsRequired) se gana
 *     rewardProduct; si tiene producto ligado (rewardProductId) se descuenta su precio.
 *     Se acumulan en card.recompensas_disponibles.
 */

export const MAIN_REWARD_KEY = 'main';

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

const isObjectIdLike = (v) => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v);

/** Id estable de un nivel (los niveles viejos no tenían id). */
export function tierId(tier) {
  if (tier && typeof tier.id === 'string' && tier.id.trim()) return tier.id.trim();
  return `t${Number(tier?.stamps) || 0}_${tier?.type || 'discount'}_${Number(tier?.value) || 0}_${tier?.product_id || ''}`;
}

/** Limpia y valida los niveles configurados. Descarta los que no tienen sentido. */
export function normalizeTiers(rewards, stampsRequired) {
  const req = Math.max(1, parseInt(stampsRequired, 10) || 10);
  const list = Array.isArray(rewards) ? rewards : [];
  const out = [];
  for (const r of list) {
    if (!r || typeof r !== 'object') continue;
    const stamps = parseInt(r.stamps, 10);
    const type = r.type === 'free' ? 'free' : 'discount';
    if (!Number.isFinite(stamps) || stamps < 1 || stamps >= req) continue; // al completar la tarjeta se reinicia: un nivel >= requeridos nunca se alcanzaría
    const value = Number(r.value) || 0;
    if (type === 'discount' && (value <= 0 || value > 100)) continue;
    const product_id = isObjectIdLike(String(r.product_id || '')) ? String(r.product_id) : null;
    const description = String(r.description || '').trim()
      || (type === 'discount' ? `${value}% de descuento` : 'Producto gratis');
    out.push({ id: tierId({ ...r, stamps, type, value, product_id }), stamps, type, value: type === 'discount' ? value : 0, product_id, description });
  }
  return out.sort((a, b) => a.stamps - b.stamps);
}

/**
 * Recompensas que la tarjeta puede usar AHORA.
 * @param card   { sellos_actuales, recompensas_disponibles, niveles_usados, estado }
 * @param config { stampsRequired, rewards, rewardProduct, rewardProductId, enabled }
 */
export function getAvailableRewards(card, config) {
  if (!card || !config || card.estado && card.estado !== 'activa') return [];
  if (config.enabled === false) return [];
  const used = new Set((card.niveles_usados || []).map(String));
  const sellos = Number(card.sellos_actuales) || 0;
  const out = [];

  if ((Number(card.recompensas_disponibles) || 0) > 0) {
    const pid = isObjectIdLike(String(config.rewardProductId || '')) ? String(config.rewardProductId) : null;
    out.push({
      key: MAIN_REWARD_KEY,
      type: pid ? 'free' : 'manual',
      value: 0,
      product_id: pid,
      description: config.rewardProduct || 'Recompensa',
      count: Number(card.recompensas_disponibles) || 0
    });
  }

  for (const t of normalizeTiers(config.rewards, config.stampsRequired)) {
    if (sellos < t.stamps || used.has(t.id)) continue;
    out.push({
      key: `tier:${t.id}`,
      tierId: t.id,
      stamps: t.stamps,
      // Producto gratis sin producto ligado: se entrega a mano ("Canjear")
      type: t.type === 'free' && !t.product_id ? 'manual' : t.type,
      value: t.value,
      product_id: t.product_id,
      description: t.description
    });
  }
  return out;
}

/** La mejor recompensa para aplicar sola al escanear (descuento % más alto). */
export function pickAutoReward(available) {
  const discounts = (available || []).filter(r => r.type === 'discount');
  if (discounts.length === 0) return null;
  return discounts.sort((a, b) => b.value - a.value || b.stamps - a.stamps)[0];
}

/**
 * Cuánto descuenta la recompensa en esta venta.
 * @param reward       recompensa (de getAvailableRewards)
 * @param items        [{ producto_id, precio, isCombo }]  precio = unitario final
 * @param baseSubtotal subtotal después de promociones, antes de IVA
 * @returns {{ amount: number, reason: string|null }}
 */
export function computeRewardDiscount(reward, items, baseSubtotal) {
  const base = Math.max(0, round2(baseSubtotal));
  if (!reward || base <= 0) return { amount: 0, reason: reward ? 'La orden no tiene importe' : null };
  if (reward.type === 'discount') {
    return { amount: Math.min(base, round2(base * (Number(reward.value) || 0) / 100)), reason: null };
  }
  if (reward.type === 'free') {
    const line = (items || []).find(i => !i.isCombo && String(i.producto_id) === String(reward.product_id));
    if (!line) return { amount: 0, reason: 'Agrega el producto de la recompensa a la orden' };
    return { amount: Math.min(base, round2(line.precio)), reason: null };
  }
  return { amount: 0, reason: 'Esta recompensa se entrega con el botón Canjear' };
}
