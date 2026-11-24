/**
 * Motor de promociones del POS (funciones puras).
 *
 * IMPORTANTE: es una COPIA de server/src/services/promotionEngine.js para que el POS
 * muestre exactamente lo que el servidor va a cobrar. Si cambias una, cambia la otra.
 */
import { formatInTimeZone } from 'date-fns-tz';

export const PROMO_TIMEZONE = 'America/Tijuana';

// ISO: 1 = lunes ... 7 = domingo
const ISO_DAY_NAMES = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function toMinutes(hhmm, fallback) {
  const [h, m] = String(hhmm || fallback).split(':').map(n => parseInt(n, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return toMinutes(fallback, '00:00');
  return h * 60 + m;
}

// Las fechas de la promoción se capturan como fecha de calendario (input type="date")
// y se guardan como medianoche UTC: su parte YYYY-MM-DD en UTC es el día elegido.
function calendarDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * ¿La promoción está vigente ahora? (estado, rango de fechas inclusivo, días y horario,
 * todo evaluado en la hora local del negocio).
 */
export function isPromotionActiveNow(promo, now = new Date()) {
  if (!promo || promo.estado !== 'Activa') return false;

  const today = formatInTimeZone(now, PROMO_TIMEZONE, 'yyyy-MM-dd');
  const start = calendarDate(promo.fechaInicio);
  const end = calendarDate(promo.fechaFinalizacion);
  if (start && today < start) return false;
  if (end && today > end) return false;

  const dias = promo.diasSemana || [];
  if (dias.length > 0) {
    const isoDay = parseInt(formatInTimeZone(now, PROMO_TIMEZONE, 'i'), 10);
    if (!dias.includes(ISO_DAY_NAMES[isoDay])) return false;
  }

  const nowMinutes = toMinutes(formatInTimeZone(now, PROMO_TIMEZONE, 'HH:mm'), '00:00');
  const startMinutes = toMinutes(promo.horaInicio, '00:00');
  const endMinutes = toMinutes(promo.horaFinalizacion, '23:59');
  if (nowMinutes < startMinutes || nowMinutes > endMinutes) return false;

  return true;
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula los descuentos de promociones "Compra X, paga Y" (2x1, 3x2...).
 * Por cada promoción vigente se juntan todas las unidades de los productos participantes
 * (aunque estén en líneas distintas, p. ej. con diferente leche); por cada grupo de X
 * unidades, (X - Y) salen gratis, empezando por las más baratas.
 *
 * @param {Array<{producto_id, cantidad, precio, isCombo?}>} items - precio = precio unitario final
 * @param {Array} promotions
 * @param {Date} now
 * @returns {{ discount: number, details: Array }}
 */
export function computeBuyXPayYDiscounts(items, promotions, now = new Date()) {
  let discount = 0;
  const details = [];

  for (const promo of promotions || []) {
    if (promo?.tipo !== 'BUY_X_PAY_Y') continue;
    const X = parseInt(promo.cantidadComprar, 10);
    const Y = parseInt(promo.cantidadPagar, 10);
    if (!Number.isFinite(X) || !Number.isFinite(Y) || X < 1 || Y < 0 || Y >= X) continue;
    if (!isPromotionActiveNow(promo, now)) continue;

    const participantIds = new Set((promo.productosParticipantes || []).map(pp => String(pp.producto_id?._id || pp.producto_id)));

    // Unidades participantes
    const units = [];
    for (const item of items || []) {
      if (item.isCombo) continue;
      if (!participantIds.has(String(item.producto_id))) continue;
      const qty = Math.max(0, parseInt(item.cantidad, 10) || 0);
      for (let i = 0; i < qty; i++) {
        units.push({ producto_id: String(item.producto_id), producto_nombre: item.producto_nombre, precio: Number(item.precio) || 0 });
      }
    }

    const groups = Math.floor(units.length / X);
    const freeCount = groups * (X - Y);
    if (freeCount <= 0) continue;

    units.sort((a, b) => a.precio - b.precio);
    const free = units.slice(0, freeCount);
    const promoDiscount = round2(free.reduce((sum, u) => sum + u.precio, 0));
    if (promoDiscount <= 0) continue;

    const freeByProduct = new Map();
    for (const u of free) {
      const prev = freeByProduct.get(u.producto_id) || { producto_id: u.producto_id, producto_nombre: u.producto_nombre, cantidad: 0, descuento: 0 };
      prev.cantidad += 1;
      prev.descuento = round2(prev.descuento + u.precio);
      freeByProduct.set(u.producto_id, prev);
    }

    discount = round2(discount + promoDiscount);
    details.push({
      promocion_id: promo._id,
      nombre: promo.nombre,
      tipo: promo.tipo,
      descuento: promoDiscount,
      freeItems: [...freeByProduct.values()]
    });
  }

  return { discount, details };
}
