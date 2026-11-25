/**
 * Etiquetas para vasos - CoffeePOS
 *
 * Una etiqueta por cada unidad vendida (2 lattes = 2 etiquetas "1/2" y "2/2").
 * Diseño pensado para impresoras térmicas de etiquetas:
 *   - Tamaño FIJO (por defecto 50.8 × 25.4 mm = 2" × 1"; se cambia en Configuración).
 *     Antes la etiqueta crecía con el contenido y se partía en dos etiquetas.
 *   - Solo negro puro: los grises salen tenues o no salen en térmica.
 *   - Si el texto no cabe, se achica solo antes de imprimir (nunca se corta a la mitad).
 *   - El número de orden va grande: es lo que el barista lee para llamar al cliente.
 */

import {
  getCustomizationList,
  getItemNote,
  getPrintSettings,
  escapeHtml,
  printHtmlDocument
} from '../utils/printUtils.js';
import { formatBusinessDateTime } from '../utils/dateTime.js';

function folioOf(sale) {
  if (sale?.numero_venta != null && sale.numero_venta !== '') return String(sale.numero_venta).padStart(4, '0');
  return String(sale?.id || sale?._id || '').slice(-6).toUpperCase() || '----';
}

function timeOf(sale) {
  try {
    const full = formatBusinessDateTime(sale?.fecha || new Date());
    const m = String(full).match(/(\d{1,2}:\d{2})/);
    return m ? m[1] : '';
  } catch {
    return '';
  }
}

function realCustomerName(name) {
  const n = String(name || '').trim();
  if (!n || /^cliente$/i.test(n)) return '';
  return n;
}

/** Contenido (texto) de la etiqueta de una unidad. */
function labelContent(detail) {
  let p = detail.personalizaciones;
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch { p = null; } }
  const isCombo = p?.isCombo || detail.isCombo;
  const comboProducts = p?.comboProducts || detail.comboProducts;
  const product = detail.producto_nombre || detail.producto_id?.nombre || detail.nombre || 'Producto';

  let lines;
  if (isCombo && Array.isArray(comboProducts) && comboProducts.length > 0) {
    lines = comboProducts.map(cp => `${cp.nombre}${(cp.cantidadCombo || 1) > 1 ? ` x${cp.cantidadCombo}` : ''}`);
  } else {
    lines = getCustomizationList(p).map(c => c.name);
  }
  const note = getItemNote(detail);
  return { product, lines, note };
}

function buildLabel({ detail, index, total, folio, time, customer, business }) {
  const { product, lines, note } = labelContent(detail);
  return `
    <section class="label-page">
      <header class="top">
        <span class="folio">#${escapeHtml(folio)}</span>
        <span class="meta">${total > 1 ? `<b>${index}/${total}</b>` : ''}${time ? ` ${escapeHtml(time)}` : ''}</span>
      </header>
      <div class="product">${escapeHtml(product)}</div>
      <div class="customs">${lines.map(escapeHtml).join(' · ')}${note ? `${lines.length ? ' · ' : ''}<i>${escapeHtml(note)}</i>` : ''}</div>
      <footer class="bottom">
        <span class="customer">${escapeHtml(customer)}</span>
        <span class="business">${escapeHtml(business)}</span>
      </footer>
    </section>`;
}

/** HTML completo de las etiquetas de una venta (exportado para vista previa/pruebas). */
export function generateLabelsHTML(sale, customerName = null, businessInfo = null) {
  const { label } = getPrintSettings();
  const W = label.w, H = label.h;
  const small = H < 28; // etiquetas de 1" de alto: tipografía más compacta

  const details = sale?.detalles || [];
  const total = details.reduce((s, d) => s + (Number(d.cantidad) || 1), 0);
  const folio = folioOf(sale);
  const time = timeOf(sale);
  const customer = realCustomerName(customerName || sale?.cliente);
  let business = businessInfo?.businessName || sale?.businessName || sale?.business_name || '';
  if (!business) { try { business = localStorage.getItem('businessName') || ''; } catch { business = ''; } }

  let index = 0;
  const pages = details.map(detail => {
    const qty = Math.max(1, Number(detail.cantidad) || 1);
    return Array.from({ length: qty }, () => {
      index += 1;
      return buildLabel({ detail, index, total, folio, time, customer, business });
    }).join('');
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Etiquetas #${escapeHtml(folio)}</title>
<style>
  @page { size: ${W}mm ${H}mm; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #fff; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .label-page {
    width: ${W}mm;
    height: ${H}mm;
    padding: ${small ? '1.2mm 1.8mm' : '1.8mm 2.2mm'};
    overflow: hidden;
    display: flex;
    flex-direction: column;
    break-after: page;
    page-break-after: always;
  }
  .label-page:last-child { break-after: auto; page-break-after: auto; }
  .top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1mm;
    border-bottom: 0.35mm solid #000;
    padding-bottom: 0.5mm;
    margin-bottom: 0.7mm;
    flex: none;
  }
  .folio { font-size: ${small ? '12pt' : '14pt'}; font-weight: 900; line-height: 1; letter-spacing: 0.02em; }
  .meta { font-size: ${small ? '6.5pt' : '7.5pt'}; line-height: 1; white-space: nowrap; }
  .meta b { font-size: ${small ? '8pt' : '9pt'}; }
  .product {
    font-size: ${small ? '9.5pt' : '11pt'};
    font-weight: 800;
    line-height: 1.08;
    text-transform: uppercase;
    overflow-wrap: anywhere;
    flex: none;
  }
  .customs {
    font-size: ${small ? '7pt' : '8pt'};
    font-weight: 600;
    line-height: 1.15;
    margin-top: 0.5mm;
    overflow-wrap: anywhere;
    flex: 1 1 auto;
    min-height: 0;
  }
  .customs i { font-weight: 700; }
  .bottom {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 1mm;
    font-size: ${small ? '6pt' : '6.5pt'};
    line-height: 1;
    flex: none;
    margin-top: 0.4mm;
  }
  .customer { font-weight: 800; font-size: ${small ? '7pt' : '8pt'}; text-transform: uppercase; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .business { font-weight: 600; text-transform: uppercase; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 55%; text-align: right; }
  @media screen {
    body { background: #e5e7eb; padding: 4mm; }
    .label-page { background: #fff; margin: 0 auto 3mm; box-shadow: 0 0 0 0.2mm #9ca3af; }
  }
</style>
<script>
  // Si el texto no cabe, achicarlo poco a poco (nunca cortar a la mitad una línea).
  window.__beforePrint = function () {
    document.querySelectorAll('.label-page').forEach(function (page) {
      var customs = page.querySelector('.customs');
      var product = page.querySelector('.product');
      var fits = function () { return page.scrollHeight <= page.clientHeight + 0.5 && customs.scrollHeight <= customs.clientHeight + 0.5; };
      var size = parseFloat(getComputedStyle(customs).fontSize);
      while (!fits() && size > 5.2) { size -= 0.4; customs.style.fontSize = size + 'px'; }
      var psize = parseFloat(getComputedStyle(product).fontSize);
      while (!fits() && psize > 8) { psize -= 0.5; product.style.fontSize = psize + 'px'; }
    });
  };
  window.addEventListener('load', function () { window.__beforePrint(); });
</script>
</head>
<body>
${pages}
</body>
</html>`;
}

/**
 * Imprime todas las etiquetas de una venta en un solo trabajo de impresión.
 */
export function printLabels(sale, customerName = null, businessInfo = null) {
  if (!sale || !Array.isArray(sale.detalles) || sale.detalles.length === 0) {
    console.error('No hay detalles para imprimir etiquetas');
    return;
  }
  printHtmlDocument(generateLabelsHTML(sale, customerName, businessInfo), { closeDelay: 800 });
}
