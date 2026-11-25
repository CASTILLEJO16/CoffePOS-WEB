import { formatBusinessDateTime } from '../utils/dateTime.js';
import { translations } from '../utils/i18n/translations.js';
import {
  getCustomizationList,
  getItemNote,
  getPrintSettings,
  escapeHtml,
  printHtmlDocument
} from '../utils/printUtils.js';

/**
 * Servicio de Tickets para Cliente
 * Genera e imprime tickets de venta para impresora térmica (80 mm o 58 mm).
 *
 * Correcciones respecto a la versión anterior:
 *  - Ancho real de rollo térmico (antes 110 mm: se cortaban los precios en 80 mm).
 *  - Alto automático (antes 220 mm fijos: tickets largos se partían, cortos gastaban papel).
 *  - El descuento del producto ya viene en el precio: antes se restaba otra vez en el ticket
 *    y las líneas no cuadraban con el subtotal.
 *  - Se muestran todas las personalizaciones (antes solo las que tenían costo extra).
 *  - Se muestran promociones (2x1) y lealtad como líneas propias para que todo cuadre.
 *  - "Redondeo / Total efectivo" solo en pagos en efectivo.
 *  - Todo en negro (los grises salen tenues en térmica) y textos escapados.
 */

/** Traducción según el idioma del ticket. */
function t(key, language = 'es') {
  const lang = language || localStorage.getItem('idioma') || 'es';
  return translations[lang]?.[key] || translations.es?.[key] || key;
}

const METODOS = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  usd: 'Dólares',
  dolar: 'Dólares',
  mixto: 'Mixto',
  transferencia: 'Transferencia'
};

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Genera un ticket en formato HTML para impresión
 * @param {Object} sale - Venta con detalles
 * @param {string} customerName - Nombre del cliente (opcional)
 * @param {{businessName?: string, address?: string}} businessInfo - Info cafetería
 * @returns {string} HTML del ticket
 */
export function generateTicketHTML(sale, customerName = null, businessInfo = null) {
  const { ticket } = getPrintSettings();
  const narrow = ticket.paper <= 58;
  const lang = sale.idioma || localStorage.getItem('idioma') || 'es';

  const currency = sale.moneda_predeterminada || localStorage.getItem('moneda_predeterminada') || 'MXN';
  const money = (value) => {
    const num = Number(value);
    return new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'es-MX', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2
    }).format(Number.isFinite(num) ? num : 0);
  };

  // ---------- Partidas ----------
  const rowsHTML = (sale.detalles || []).map(detail => {
    let p = detail.personalizaciones;
    if (typeof p === 'string') { try { p = JSON.parse(p); } catch { p = null; } }
    const isCombo = p?.isCombo || detail.isCombo;
    const comboProducts = p?.comboProducts || detail.comboProducts;
    const qty = Number(detail.cantidad) || 1;
    const name = escapeHtml(detail.producto_nombre || detail.producto_id?.nombre || detail.nombre || 'Producto');
    const unit = Number(detail.precio) || 0; // precio unitario FINAL (ya con descuento y extras)
    const lineTotal = round2(unit * qty);

    let html = `
      <div class="item">
        <div class="item-main">
          <span class="item-qty">${qty}</span>
          <span class="item-name">${name}</span>
          <span class="item-total">${money(lineTotal)}</span>
        </div>`;

    if (isCombo && Array.isArray(comboProducts) && comboProducts.length > 0) {
      comboProducts.forEach(cp => {
        html += `<div class="item-sub">· ${escapeHtml(cp.nombre)}${(cp.cantidadCombo || 1) > 1 ? ` x${cp.cantidadCombo}` : ''}</div>`;
      });
    } else {
      // Personalizaciones: todas (las que cuestan muestran su precio)
      getCustomizationList(p).forEach(c => {
        html += `<div class="item-sub">· ${escapeHtml(c.name)}${c.price > 0 ? ` <span class="sub-price">+${money(c.price)}</span>` : ''}</div>`;
      });
      const note = getItemNote(detail);
      if (note) html += `<div class="item-sub"><i>${escapeHtml(note)}</i></div>`;

      // Descuento del producto: el precio ya lo trae, aquí solo se informa (no se resta otra vez)
      const desc = Number(detail.descuento) || 0;
      if (desc > 0 && desc < 100) {
        html += `<div class="item-sub">${t('Incluye descuento', lang)} ${desc}%</div>`;
      }
      if (qty > 1) {
        html += `<div class="item-sub">${qty} × ${money(unit)}</div>`;
      }
      if (detail.promocion_nombre && detail.promocion_tipo !== 'COMBO') {
        html += `<div class="item-sub">${t('Promoción', lang)}: ${escapeHtml(detail.promocion_nombre)}</div>`;
      }
    }
    html += '</div>';
    return html;
  }).join('');

  // ---------- Encabezado ----------
  const rawBusinessName = businessInfo?.businessName ?? sale.businessName ?? sale.business_name ?? null;
  const rawAddress = businessInfo?.address ?? sale.businessAddress ?? sale.business_address ?? sale.address ?? null;
  const cachedBusinessName = !rawBusinessName ? localStorage.getItem('businessName') : null;
  const cachedAddress = !rawAddress ? localStorage.getItem('businessAddress') : null;
  const businessName = escapeHtml(rawBusinessName || cachedBusinessName || 'CAFETERÍA');
  const address = rawAddress || cachedAddress ? escapeHtml(rawAddress || cachedAddress) : null;

  let folio;
  if (sale.numero_venta != null && sale.numero_venta !== '') folio = String(sale.numero_venta).padStart(4, '0');
  else if (sale.numeroVenta != null) folio = String(sale.numeroVenta).padStart(4, '0');
  else folio = String(sale.id || sale._id || 'N/A').slice(-6).toUpperCase();

  const cashier = sale.usuario_id?.nombre || sale.usuario_nombre || null;
  const metodo = METODOS[sale.metodo_pago] || String(sale.metodo_pago || '').toUpperCase();
  const tarjeta = sale.metodo_pago === 'tarjeta' && sale.tipo_tarjeta ? ` (${escapeHtml(String(sale.tipo_tarjeta))})` : '';

  // ---------- Totales ----------
  const promo = Number(sale.descuento_promociones) || 0;
  const loyalty = Number(sale.descuento_lealtad) || 0;
  // Suma de las partidas = subtotal + descuentos de venta (2x1 y lealtad)
  const itemsSum = round2(Number(sale.subtotal || 0) + promo + loyalty);
  const ivaPercent = sale.iva_rate != null
    ? Math.round(Number(sale.iva_rate) * 100)
    : (sale.subtotal > 0 ? Math.round((sale.impuestos / sale.subtotal) * 100) : 0);

  const tipoCambio = Number(sale.tipo_cambio) || 20;
  const isCash = sale.metodo_pago === 'efectivo';
  const cashTotal = Math.round(Number(sale.total || 0) / 0.05) * 0.05; // redondeo a 5 centavos
  const cashDiff = round2(cashTotal - Number(sale.total || 0));

  const row = (label, value, cls = '') => `<div class="row ${cls}"><span>${label}</span><span>${value}</span></div>`;

  let paymentHTML = '';
  if (sale.metodo_pago === 'mixto') {
    paymentHTML += `<div class="section-title">${t('Desglose de Pago:', lang)}</div>`;
    if (sale.efectivo_mxn > 0) paymentHTML += row(t('Efectivo MXN:', lang), money(sale.efectivo_mxn));
    if (sale.efectivo_usd > 0) {
      paymentHTML += row(t('Efectivo USD:', lang), `$${Number(sale.efectivo_usd).toFixed(2)} USD`);
      paymentHTML += row(`&nbsp;&nbsp;${t('(= MXN):', lang)}`, money(sale.efectivo_usd * tipoCambio));
    }
    if (sale.tarjeta_credito > 0) paymentHTML += row(t('Tarjeta Crédito:', lang), money(sale.tarjeta_credito));
    if (sale.tarjeta_debito > 0) paymentHTML += row(t('Tarjeta Débito:', lang), money(sale.tarjeta_debito));
    if (sale.cambio_pesos > 0) paymentHTML += row(t('Cambio MXN:', lang), money(sale.cambio_pesos));
    if (sale.tipo_cambio) paymentHTML += row(t('Tipo de Cambio:', lang), `1 USD = $${tipoCambio.toFixed(2)}`, 'small');
  } else if (sale.metodo_pago === 'dolar' || sale.metodo_pago === 'usd') {
    if (sale.monto_dolar) paymentHTML += row(t('Monto USD:', lang), `$${Number(sale.monto_dolar).toFixed(2)} USD`);
    if (sale.dolar_recibido) paymentHTML += row(t('Recibido USD:', lang), `$${Number(sale.dolar_recibido).toFixed(2)} USD`);
    if (sale.cambio_pesos != null) paymentHTML += row(t('Cambio MXN:', lang), money(sale.cambio_pesos));
    if (sale.tipo_cambio) paymentHTML += row(t('Tipo de Cambio:', lang), `1 USD = $${tipoCambio.toFixed(2)}`, 'small');
  } else if (isCash) {
    if (Math.abs(cashDiff) >= 0.01) {
      paymentHTML += row(t('Redondeo:', lang), money(cashDiff), 'small');
      paymentHTML += row(t('TOTAL EFECTIVO:', lang), money(cashTotal), 'strong');
    }
    paymentHTML += row(t('Total USD:', lang), `$${(Number(sale.total || 0) / tipoCambio).toFixed(2)} USD`, 'small');
  }

  const W = ticket.printable; // ancho imprimible en mm

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Ticket #${escapeHtml(folio)}</title>
<style>
  /* Sin tamaño fijo: la impresora térmica usa su rollo y el alto sale según el contenido */
  @page { margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #fff; }
  body {
    width: ${ticket.paper}mm;
    padding: 3mm ${(ticket.paper - W) / 2}mm 6mm;
    font-family: 'Courier New', Courier, monospace;
    font-size: ${narrow ? '10.5px' : '12px'};
    line-height: 1.3;
    color: #000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .ticket { width: ${W}mm; }
  .center { text-align: center; }
  .header { text-align: center; padding-bottom: 2mm; border-bottom: 1px dashed #000; margin-bottom: 2mm; }
  .header h1 { font-size: ${narrow ? '14px' : '16px'}; font-weight: 900; line-height: 1.15; overflow-wrap: anywhere; }
  .address { font-size: ${narrow ? '9.5px' : '10.5px'}; margin-top: 1mm; overflow-wrap: anywhere; }
  .folio { font-size: ${narrow ? '16px' : '20px'}; font-weight: 900; margin: 1.5mm 0 0.5mm; letter-spacing: 0.04em; }
  .row { display: flex; justify-content: space-between; gap: 2mm; }
  .row span:last-child { text-align: right; white-space: nowrap; }
  .row span:first-child { overflow-wrap: anywhere; }
  .small { font-size: 0.9em; }
  .strong { font-weight: 900; }
  .info { padding-bottom: 2mm; border-bottom: 1px dashed #000; margin-bottom: 2mm; }
  .info .row span:first-child { flex: none; white-space: nowrap; }
  .info .row span:last-child { white-space: normal; overflow-wrap: anywhere; }
  .items-head { display: flex; font-weight: 900; font-size: 0.9em; border-bottom: 1px solid #000; padding-bottom: 0.5mm; margin-bottom: 1mm; }
  .items-head .h-qty, .item-qty { width: ${narrow ? '7mm' : '10mm'}; flex: none; padding-right: 1mm; }
  .items-head .h-name, .item-name { flex: 1; min-width: 0; }
  .items-head .h-total, .item-total { flex: none; text-align: right; white-space: nowrap; padding-left: 1.5mm; }
  .item { padding: 0.8mm 0; }
  .item + .item { border-top: 1px dotted #000; }
  .item-main { display: flex; align-items: baseline; }
  .item-name { font-weight: 700; overflow-wrap: anywhere; }
  .item-sub { padding-left: ${narrow ? '7mm' : '10mm'}; font-size: 0.92em; overflow-wrap: anywhere; }
  .sub-price { white-space: nowrap; }
  .totals { border-top: 1px dashed #000; margin-top: 1.5mm; padding-top: 1.5mm; }
  .grand { font-size: ${narrow ? '14px' : '16px'}; font-weight: 900; border-top: 1px solid #000; margin-top: 1mm; padding-top: 1mm; }
  .section-title { font-weight: 900; margin-top: 1.5mm; }
  .payment { border-top: 1px dashed #000; margin-top: 1.5mm; padding-top: 1.5mm; }
  .footer { text-align: center; border-top: 1px dashed #000; margin-top: 2mm; padding-top: 2mm; }
  .footer .small { margin-top: 1mm; }
  @media screen {
    body { margin: 4mm auto; box-shadow: 0 0 0 1px #d1d5db; }
  }
</style>
</head>
<body>
<div class="ticket">
  <div class="header">
    <h1>${businessName}</h1>
    ${address ? `<div class="address">${address}</div>` : ''}
    <div class="folio">#${escapeHtml(folio)}</div>
  </div>

  <div class="info">
    ${row(t('Fecha:', lang), escapeHtml(formatBusinessDateTime(sale.fecha)))}
    ${customerName ? row(t('Cliente:', lang), escapeHtml(customerName)) : ''}
    ${cashier ? row(t('Atendió:', lang), escapeHtml(cashier)) : ''}
    ${row(t('Método:', lang), `${escapeHtml(t(metodo, lang))}${tarjeta}`)}
  </div>

  <div class="items-head">
    <span class="h-qty">${t('CANT', lang)}</span>
    <span class="h-name">${t('PRODUCTO', lang)}</span>
    <span class="h-total">${t('TOTAL', lang)}</span>
  </div>
  ${rowsHTML}

  <div class="totals">
    ${promo > 0 || loyalty > 0 ? row(t('Suma:', lang), money(itemsSum)) : ''}
    ${promo > 0 ? row(t('Promociones', lang), `-${money(promo)}`) : ''}
    ${loyalty > 0 ? row(`${t('Lealtad', lang)}${sale.recompensa_lealtad?.descripcion ? ` (${escapeHtml(sale.recompensa_lealtad.descripcion)})` : ''}`, `-${money(loyalty)}`) : ''}
    ${row(t('Subtotal:', lang), money(sale.subtotal))}
    ${row(t('IVA (%):', lang).replace('%', ivaPercent + '%'), money(sale.impuestos))}
    ${row(`${t('TOTAL', lang)}:`, money(sale.total), 'grand')}
  </div>

  ${paymentHTML ? `<div class="payment">${paymentHTML}</div>` : ''}

  <div class="footer">
    <div>${t('¡Gracias por su compra!', lang)}</div>
    <div class="small">${t('Desarrollado por CoffeePOS', lang)}</div>
  </div>
</div>
</body>
</html>`;
}

/**
 * Imprime un ticket de venta
 * @param {Object} sale - Venta con detalles
 * @param {string} customerName - Nombre del cliente (opcional)
 * @param {{businessName?: string, address?: string}} businessInfo - opcional; si no, se toma de localStorage/sale
 */
export function printTicket(sale, customerName = null, businessInfo = null) {
  let resolvedBusiness = businessInfo;
  if (!resolvedBusiness) {
    try {
      const bName = localStorage.getItem('businessName');
      const bAddr = localStorage.getItem('businessAddress');
      if (bName || bAddr) resolvedBusiness = { businessName: bName, address: bAddr };
    } catch { /* sin caché */ }
  }
  printHtmlDocument(generateTicketHTML(sale, customerName, resolvedBusiness), { closeDelay: 500 });
}
