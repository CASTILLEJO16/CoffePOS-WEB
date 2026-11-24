import { computeBuyXPayYDiscounts } from './promotionEngine.js';

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function getIVARate() {
  const val = localStorage.getItem('iva_rate');
  const num = val ? parseFloat(val) : 0.16;
  return Number.isFinite(num) ? num : 0.16;
}

/**
 * Totales del carrito, con la MISMA regla que usa el servidor al cobrar:
 * - subtotal = suma de importes - descuento de promociones "Compra X, paga Y"
 * - IVA sobre el subtotal con descuento
 *
 * @returns {{ subtotal, impuestos, total, promoDiscount, promoDetails }}
 */
export function calculateCartTotals(items, promotions = []) {
  const gross = round2((items || []).reduce((sum, item) => sum + (Number(item.importe) || 0), 0));

  const { discount, details } = computeBuyXPayYDiscounts(
    (items || []).map(item => ({
      producto_id: item.producto_id,
      producto_nombre: item.producto_nombre,
      cantidad: item.cantidad,
      precio: round2(item.precio_final),
      isCombo: item.isCombo || item.personalizaciones?.isCombo
    })),
    promotions,
    new Date()
  );

  const promoDiscount = Math.min(round2(discount), gross);
  const subtotal = round2(gross - promoDiscount);
  const impuestos = round2(subtotal * getIVARate());
  const total = round2(subtotal + impuestos);

  return { subtotal, impuestos, total, promoDiscount, promoDetails: details };
}
