import { formatBusinessTime } from '../utils/dateTime.js';

/**
 * Servicio de Etiquetas para Vasos
 * Genera e imprime etiquetas individuales para cada producto
 */

function escapeLabel(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/**
 * Genera el HTML de una etiqueta individual
 * @param {Object} detail - Detalle de venta con producto
 * @param {string} customerName - Nombre del cliente
 * @param {string} folio - Folio legible (numero_venta padded)
 * @param {string} businessName - Nombre cafetería opcional
 * @returns {string} HTML de la etiqueta
 */
function generateLabelHTML(detail, customerName, folio, businessName = null) {
  const customizationDetails = getCustomizationDetails(detail.personalizaciones);
  const productName = escapeLabel(detail.producto_nombre || detail.producto_id?.nombre || detail.nombre || 'Producto');
  const safeCustomer = escapeLabel((customerName || 'CLIENTE').toUpperCase());
  const safeFolio = escapeLabel(folio || '—');
  const safeBusiness = businessName ? escapeLabel(businessName) : null;
  const hasCustom = customizationDetails.length > 0;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${productName} - ${safeCustomer} #${safeFolio}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Inter', Arial, Helvetica, sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          width: 50.8mm;
          min-height: 25.4mm;
          padding: 2mm;
          margin: 0 auto;
          background: white;
          color: #111;
        }
        .label {
          width: 100%;
          min-height: 21mm;
          border: 1.4px solid #111;
          border-radius: 2.5mm;
          padding: 2mm 2.2mm 1.6mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 1mm;
        }
        .label-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 6px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #6b7280;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 1mm;
          margin-bottom: 0.5mm;
        }
        .folio { font-weight: 700; color: #111; letter-spacing: 0.06em; }
        .customer-name {
          font-size: 11px;
          font-weight: 800;
          line-height: 1.05;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #111;
          text-align: center;
          word-break: break-word;
        }
        .product-row {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 1.2mm;
          flex-wrap: wrap;
        }
        .product {
          font-size: 8.5px;
          font-weight: 700;
          text-transform: uppercase;
          color: #1f2937;
          text-align: center;
          line-height: 1.1;
          word-break: break-word;
        }
        .quantity-badge {
          display: inline-block;
          background: #111;
          color: #fff;
          font-size: 6.5px;
          font-weight: 800;
          padding: 0.8px 2.2px;
          border-radius: 1mm;
          line-height: 1;
        }
        .customization {
          display: flex;
          flex-wrap: wrap;
          gap: 1mm;
          justify-content: center;
        }
        .chip {
          font-size: 6px;
          font-weight: 600;
          color: #374151;
          background: #f3f4f6;
          border: 0.4px solid #e5e7eb;
          border-radius: 999px;
          padding: 0.7px 2mm;
          line-height: 1.2;
          max-width: 100%;
          word-break: break-word;
        }
        .label-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 5.5px;
          color: #9ca3af;
          letter-spacing: 0.04em;
          border-top: 1px solid #f3f4f6;
          padding-top: 1mm;
          margin-top: 0.5mm;
        }
        @media print {
          body { width: 50.8mm; margin: 0; padding: 1.5mm; }
          @page { margin: 0; size: 50.8mm 25.4mm; }
        }
      </style>
    </head>
    <body>
      <div class="label">
        ${safeBusiness ? `<div class="label-top"><span>${safeBusiness}</span><span class="folio">#${safeFolio}</span></div>` : `<div class="label-top" style="justify-content:center"><span class="folio">#${safeFolio}</span></div>`}
        <div class="customer-name">${safeCustomer}</div>
        <div class="product-row">
          <span class="product">${productName}</span>
          ${detail.cantidad > 1 ? `<span class="quantity-badge">${detail.cantidad}x</span>` : ''}
        </div>
        ${hasCustom ? `<div class="customization">${customizationDetails.map(c => `<span class="chip">${escapeLabel(c)}</span>`).join('')}</div>` : ''}
        <div class="label-footer"><span>${safeBusiness || 'CoffeePOS'}</span><span>#${safeFolio}</span></div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Obtiene los detalles de personalizaciones para la etiqueta
 * @param {Object} personalizaciones - Objeto de personalizaciones
 * @returns {Array} Array con detalles formateados de personalizaciones
 */
function getCustomizationDetails(personalizaciones) {
  if (!personalizaciones) return [];
  
  const details = [];
  const p = personalizaciones;

  console.log('[LabelService] getCustomizationDetails - personalizaciones:', JSON.stringify(personalizaciones, null, 2));

  // Función helper para extraer el nombre de un objeto
  const extractName = (value) => {
    if (!value) return null;
    if (typeof value === 'string') {
      // Limpiar strings que parecen JSON
      if (value.includes('","name":"')) {
        const match = value.match(/"name":"([^"]+)"/);
        return match ? match[1] : value;
      }
      return value;
    }
    if (typeof value === 'object') {
      // Intentar diferentes propiedades donde podría estar el nombre
      return value.name || value.nombre || value.label || value.descripcion || 
             value.id || value.value || null;
    }
    return String(value);
  };

  // Función helper para agregar detalles con etiquetas en español
  const addDetail = (label, value) => {
    const extractedValue = extractName(value);
    if (extractedValue && extractedValue !== 'none' && extractedValue !== 'default' && extractedValue !== '' && extractedValue !== 'null' && extractedValue !== 'undefined') {
      details.push(`${label}: ${extractedValue}`);
    }
  };

  // Mapeo de nombres de propiedades a español
  const labelMap = {
    'milkType': 'Leche',
    'milk': 'Leche',
    'toppings': 'Extras',
    'topping': 'Extra',
    'coldFoam': 'Cold Foam',
    'cold_foam': 'Cold Foam',
    'syrup': 'Sirope',
    'sweetness': 'Dulzura',
    'teaOption': 'Té',
    'tea': 'Té',
    'tea_option': 'Té'
  };

  // Extraer todas las personalizaciones posibles
  Object.keys(p).forEach(key => {
    const value = p[key];
    const spanishLabel = labelMap[key] || key.charAt(0).toUpperCase() + key.slice(1);
    
    if (value) {
      if (typeof value === 'object') {
        if (Array.isArray(value)) {
          value.forEach(item => {
            addDetail(spanishLabel, item);
          });
        } else {
          addDetail(spanishLabel, value);
        }
      } else if (typeof value !== 'object') {
        addDetail(spanishLabel, value);
      }
    }
  });
  
  console.log('[LabelService] getCustomizationDetails - detalles extraídos:', details);
  return details;
}

/**
 * Imprime una etiqueta individual (uso manual)
 */
function printSingleLabel(detail, customerName, folio, businessName = null) {
  const labelHTML = generateLabelHTML(detail, customerName, folio, businessName);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(labelHTML);
    printWindow.document.close();
    printWindow.onload = function() {
      printWindow.print();
      printWindow.close();
    };
  } else {
    console.error('No se pudo abrir la ventana de impresión para etiqueta');
  }
}

/**
 * Imprime etiquetas para todos los productos de una venta - 1 solo diálogo
 * @param {Object} sale - Venta con detalles
 * @param {string} customerName
 * @param {{businessName?: string}} businessInfo - opcional, nombre cafetería
 */
export function printLabels(sale, customerName = null, businessInfo = null) {
  if (!sale || !sale.detalles || sale.detalles.length === 0) {
    console.error('No hay detalles para imprimir etiquetas');
    return;
  }
  const finalCustomerName = customerName || sale.cliente || 'Cliente';
  const businessName = businessInfo?.businessName || sale.businessName || sale.business_name || (typeof localStorage !== 'undefined' ? localStorage.getItem('businessName') : null) || null;
  let folio;
  if (sale.numero_venta != null && sale.numero_venta !== '') folio = String(sale.numero_venta).padStart(4, '0');
  else folio = String(sale.id || sale._id || 'N/A').slice(-6).toUpperCase();

  // Generar combo: cada copia como página independiente
  const pagesHtml = sale.detalles.map(detail => {
    const qty = detail.cantidad || 1;
    return Array.from({ length: qty }).map(() => {
      const single = generateLabelHTML(detail, finalCustomerName, folio, businessName);
      // Reutilizar markup interno extrayendo .label y reenvolviendo
      const m = single.match(/<div class="label">[\s\S]*?<\/div>\s*<\/body>/);
      const labelDiv = single.match(/<div class="label">[\s\S]*?<\/div>/);
      const content = labelDiv ? labelDiv[0] : single;
      // Extraer estilos ya no necesario, usaremos wrapper propio
      const inner = content.replace(/<div class="label">/, '<div class="label-inner">').replace(/<\/div>\s*$/, '</div>');
      // Más simple: regenerar directamente el body del label sin re-parsear, usamos generate
      return single; // placeholder reemplazado abajo
    }).join('');
  });

  // Construcción limpia: generar cada etiqueta completa y extraer solo el <div class="label">...</div>
  const labelsHtml = sale.detalles.map(detail => {
    const qty = detail.cantidad || 1;
    return Array.from({ length: qty }).map(() => {
      const html = generateLabelHTML(detail, finalCustomerName, folio, businessName);
      const extracted = html.match(/<div class="label">[\s\S]*?<\/div>\s*<\/body>/);
      const divMatch = html.match(/<div class="label">[\s\S]*?<\/div>/);
      const labelBlock = divMatch ? divMatch[0] : html;
      return `<div class="label-page">${labelBlock}</div>`;
    }).join('');
  }).join('');

  const combinedHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Etiquetas #${escapeLabel(folio)} - ${escapeLabel(finalCustomerName)}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { background: white; }
        body { font-family: 'Inter', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .label-page { width: 50.8mm; min-height: 25.4mm; padding: 1.5mm; margin: 0 auto; page-break-after: always; display: flex; align-items: center; justify-content: center; }
        .label-page:last-child { page-break-after: auto; }
        .label { width: 100%; min-height: 21mm; border: 1.4px solid #111; border-radius: 2.5mm; padding: 2mm 2.2mm 1.6mm; display: flex; flex-direction: column; justify-content: space-between; gap: 1mm; }
        .label-top { display: flex; justify-content: space-between; align-items: center; font-size: 6px; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 1mm; margin-bottom: 0.5mm; }
        .folio { font-weight: 700; color: #111; }
        .customer-name { font-size: 11px; font-weight: 800; text-transform: uppercase; text-align: center; line-height: 1.05; letter-spacing: 0.04em; word-break: break-word; }
        .product-row { display: flex; gap: 1.2mm; justify-content: center; flex-wrap: wrap; align-items: baseline; }
        .product { font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #1f2937; text-align: center; line-height: 1.1; word-break: break-word; }
        .quantity-badge { background: #111; color: #fff; font-size: 6.5px; font-weight: 800; padding: 0.8px 2.2px; border-radius: 1mm; }
        .customization { display: flex; flex-wrap: wrap; gap: 1mm; justify-content: center; }
        .chip { font-size: 6px; font-weight: 600; color: #374151; background: #f3f4f6; border: 0.4px solid #e5e7eb; border-radius: 999px; padding: 0.7px 2mm; line-height: 1.2; word-break: break-word; }
        .label-footer { display: flex; justify-content: space-between; font-size: 5.5px; color: #9ca3af; letter-spacing: 0.04em; border-top: 1px solid #f3f4f6; padding-top: 1mm; margin-top: 0.5mm; }
        @media print { @page { margin: 0; size: 50.8mm 25.4mm; } body { margin: 0; } }
      </style>
    </head>
    <body>
      ${labelsHtml}
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(combinedHtml);
    printWindow.document.close();
    printWindow.onload = function() {
      // No usar setTimeout largo: imprime ya; si el navegador añade header/footer, es config del usuario (desactivable en diálogo)
      printWindow.focus();
      printWindow.print();
      // No cerrar inmediatamente en algunos navegadores: dar 500ms
      setTimeout(() => { try { printWindow.close(); } catch {} }, 600);
    };
  } else {
    console.error('No se pudo abrir la ventana de impresión para etiquetas');
  }
}
