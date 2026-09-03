/**
 * Servicio de Etiquetas para Vasos - CoffeePOS
 * Genera e imprime etiquetas 50.8mm x 25.4mm
 */

function escapeLabel(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getCustomizationDetails(personalizaciones) {
  if (!personalizaciones) return [];
  const details = [];
  const p = personalizaciones;
  const extractName = (value) => {
    if (!value) return null;
    if (typeof value === 'string') {
      if (value.includes('","name":"')) {
        const m = value.match(/"name":"([^"]+)"/);
        return m ? m[1] : value;
      }
      return value;
    }
    if (typeof value === 'object') return value.name || value.nombre || value.label || value.descripcion || value.id || null;
    return String(value);
  };
  const addDetail = (label, value) => {
    const v = extractName(value);
    if (v && v !== 'none' && v !== 'default' && v !== '' && v !== 'null' && v !== 'undefined') details.push(`${label}: ${v}`);
  };
  const labelMap = { milkType:'Leche', milk:'Leche', toppings:'Extras', topping:'Extra', coldFoam:'Cold Foam', cold_foam:'Cold Foam', syrup:'Sirope', sweetness:'Dulzura', teaOption:'Té', tea:'Té', tea_option:'Té' };
  Object.keys(p).forEach(key => {
    const value = p[key];
    const label = labelMap[key] || key.charAt(0).toUpperCase()+key.slice(1);
    if (!value) return;
    if (Array.isArray(value)) value.forEach(item => addDetail(label, item));
    else if (typeof value === 'object') addDetail(label, value);
    else addDetail(label, value);
  });
  return details;
}

// Fragmento exacto al boceto ASCII: caja centrada, todo en mayúsculas y centrado
function buildLabelFragment(detail, customerName, folio, businessName) {
  const rawDetails = getCustomizationDetails(detail.personalizaciones);
  // Para etiqueta minimalista, mostrar solo el valor (sin "Leche: ")
  const customizationLines = rawDetails.map(s => {
    const parts = s.split(':');
    return parts.length > 1 ? parts.slice(1).join(':').trim() : s;
  });
  const productName = escapeLabel((detail.producto_nombre || detail.producto_id?.nombre || detail.nombre || 'Producto').toUpperCase());
  const safeBusiness = escapeLabel((businessName || 'COFFEEPOS').toUpperCase());
  const safeCustomer = escapeLabel((customerName || 'CLIENTE').toUpperCase());
  const safeFolio = escapeLabel(folio || '—');
  const qty = detail.cantidad > 1 ? `  x${detail.cantidad}` : '';
  return `
    <div class="label">
      <div class="label-business">${safeBusiness}</div>
      <div class="label-client">${safeCustomer}</div>
      <div class="label-spacer"></div>
      <div class="label-product">${productName}${qty ? `<span class="label-qty">${escapeLabel(qty)}</span>` : ''}</div>
      ${customizationLines.length > 0 ? `<div class="label-customs">${customizationLines.map(l => `<div class="custom-line">${escapeLabel(l)}</div>`).join('')}</div>` : '<div class="label-customs"><div class="custom-line" style="opacity:0.35">Sin personalización</div></div>'}
      <div class="label-spacer"></div>
      <div class="label-folio">#${safeFolio}</div>
    </div>
  `;
}

function generateLabelHTML(detail, customerName, folio, businessName = null) {
  const fragment = buildLabelFragment(detail, customerName, folio, businessName);
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title></title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Inter', Arial, Helvetica, sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          width: 50.8mm;
          min-height: 28mm;
          padding: 2mm;
          margin: 0 auto;
          background: white;
          color: #111;
        }
        .label {
          width: 100%;
          min-height: 24mm;
          border: 1.6px solid #111;
          border-radius: 3mm;
          padding: 3mm 3mm 2.5mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 1.2mm;
        }
        .label-business { font-size: 7px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; color: #111; line-height: 1; }
        .label-client { font-size: 6.5px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #6b7280; line-height: 1; margin-top: 0.5mm; }
        .label-spacer { flex: 1; min-height: 2mm; }
        .label-product { font-size: 13px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; color: #111; line-height: 1; word-break: break-word; text-align: center; }
        .label-qty { font-size: 7px; font-weight: 700; vertical-align: super; margin-left: 1mm; color: #374151; }
        .label-customs { display: flex; flex-direction: column; gap: 0.7mm; align-items: center; }
        .custom-line { font-size: 7.5px; font-weight: 500; color: #374151; line-height: 1.2; text-transform: capitalize; word-break: break-word; text-align: center; }
        .label-folio { font-size: 5.5px; font-weight: 600; letter-spacing: 0.14em; color: #9ca3af; margin-top: 1mm; }
        @page { margin: 0; size: 50.8mm 28mm; }
        @media print { body { width: 50.8mm; margin: 0; padding: 1.5mm; } @page { margin: 0; size: 50.8mm 28mm; } }
      </style>
    </head>
    <body>
      ${fragment}
    </body>
    </html>
  `;
}

function printSingleLabel(detail, customerName, folio, businessName = null) {
  const labelHTML = generateLabelHTML(detail, customerName, folio, businessName);
  const w = window.open('', '_blank');
  if (w) {
    w.document.write(labelHTML);
    w.document.close();
    w.onload = () => { w.focus(); w.print(); setTimeout(()=>{ try{ w.close(); }catch{} }, 600); };
  }
}

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

  // 1 solo documento con todas las copias - sin regex, usa fragmento directo
  const pages = sale.detalles.map(detail => {
    const qty = detail.cantidad || 1;
    return Array.from({ length: qty }).map(() => {
      const fragment = buildLabelFragment(detail, finalCustomerName, folio, businessName);
      return `<div class="label-page">${fragment}</div>`;
    }).join('');
  }).join('');

  const combinedHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title></title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { background: white; margin: 0; padding: 0; }
        body { font-family: 'Inter', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .label-page { width: 50.8mm; min-height: 28mm; padding: 1.5mm; margin: 0 auto; page-break-after: always; display: flex; align-items: center; justify-content: center; }
        .label-page:last-child { page-break-after: auto; }
        .label { width: 100%; min-height: 24mm; border: 1.6px solid #111; border-radius: 3mm; padding: 3mm 3mm 2.5mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 1.2mm; }
        .label-business { font-size: 7px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; color: #111; line-height: 1; }
        .label-client { font-size: 6.5px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #6b7280; line-height: 1; margin-top: 0.5mm; }
        .label-spacer { flex: 1; min-height: 2mm; }
        .label-product { font-size: 13px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; color: #111; line-height: 1; word-break: break-word; }
        .label-qty { font-size: 7px; font-weight: 700; vertical-align: super; margin-left: 1mm; color: #374151; }
        .label-customs { display: flex; flex-direction: column; gap: 0.7mm; align-items: center; }
        .custom-line { font-size: 7.5px; font-weight: 500; color: #374151; line-height: 1.2; text-transform: capitalize; word-break: break-word; text-align: center; }
        .label-folio { font-size: 5.5px; font-weight: 600; letter-spacing: 0.14em; color: #9ca3af; margin-top: 1mm; }
        @page { margin: 0; size: 50.8mm 28mm; }
        @media print { @page { margin: 0; size: 50.8mm 28mm; } html, body { margin: 0; padding: 0; } }
      </style>
    </head>
    <body>
      ${pages}
    </body>
    </html>
  `;

  const w = window.open('', '_blank');
  if (w) {
    w.document.write(combinedHtml);
    w.document.close();
    w.onload = () => { w.focus(); w.print(); setTimeout(()=>{ try{ w.close(); }catch{} }, 800); };
  } else {
    console.error('No se pudo abrir la ventana de impresión para etiquetas');
  }
}
