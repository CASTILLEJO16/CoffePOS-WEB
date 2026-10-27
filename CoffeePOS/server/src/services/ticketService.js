/**
 * Servicio de Tickets
 * Genera tickets en formato ESC/POS para impresoras térmicas
 */

// Traducciones para tickets
const TICKET_TRANSLATIONS = {
  es: {
    ticket: 'Ticket #',
    fecha: 'Fecha',
    metodo_pago_mixto: 'MÉTODO DE PAGO: MIXTO',
    metodo_pago_usd: 'MÉTODO DE PAGO: USD',
    metodo_pago_tarjeta: 'MÉTODO DE PAGO: TARJETA',
    efectivo_mxn: 'Efectivo MXN',
    efectivo_usd: 'Efectivo USD',
    equivalente_mxn: '(= MXN)',
    tarjeta_credito: 'Tarjeta Crédito',
    tarjeta_debito: 'Tarjeta Débito',
    tipo_cambio: 'Tipo de Cambio',
    monto_usd: 'Monto USD',
    recibido_usd: 'Recibido USD',
    cambio_mxn: 'Cambio MXN',
    tipo: 'Tipo',
    cant: 'CANT',
    producto: 'PRODUCTO',
    precio: 'PRECIO',
    importe: 'IMPORTE',
    descuento: 'Descuento',
    subtotal: 'Subtotal',
    iva: 'IVA',
    total: 'TOTAL',
    gracias: '¡Gracias por su compra!',
    desarrollado_por: 'Desarrollado por CoffeePOS',
  },
  en: {
    ticket: 'Ticket #',
    fecha: 'Date',
    metodo_pago_mixto: 'PAYMENT METHOD: MIXED',
    metodo_pago_usd: 'PAYMENT METHOD: USD',
    metodo_pago_tarjeta: 'PAYMENT METHOD: CARD',
    efectivo_mxn: 'Cash MXN',
    efectivo_usd: 'Cash USD',
    equivalente_mxn: '(= MXN)',
    tarjeta_credito: 'Credit Card',
    tarjeta_debito: 'Debit Card',
    tipo_cambio: 'Exchange Rate',
    monto_usd: 'Amount USD',
    recibido_usd: 'Received USD',
    cambio_mxn: 'Change MXN',
    tipo: 'Type',
    cant: 'QTY',
    producto: 'PRODUCT',
    precio: 'PRICE',
    importe: 'AMOUNT',
    descuento: 'Discount',
    subtotal: 'Subtotal',
    iva: 'Tax',
    total: 'TOTAL',
    gracias: 'Thank you for your purchase!',
    desarrollado_por: 'Developed by CoffeePOS',
  }
};

/**
 * Genera un ticket en formato texto para impresión
 * @param {Object} sale - Venta con detalles
 * @returns {string} Ticket formateado
 */
export function generateTicket(sale, businessInfo = null) {
  const lines = [];
  const width = 42; // Ancho estándar para impresoras térmicas

  // Determinar idioma del ticket (usar configuración de la venta o default español)
  const language = sale.idioma || 'es';
  const t = TICKET_TRANSLATIONS[language] || TICKET_TRANSLATIONS.es;

  // Encabezado - nombre y dirección de cafetería (Client.businessName)
  const businessName = (businessInfo?.businessName || sale.businessName || sale.business_name || 'CAFETERÍA POS').toString().toUpperCase();
  const businessAddress = businessInfo?.address || sale.businessAddress || sale.address || null;
  lines.push(''.padEnd(width, '='));
  // Centrar nombre (truncar si muy largo)
  const headerName = businessName.substring(0, width).padStart(Math.floor((width + businessName.substring(0,width).length)/2)).padEnd(width);
  lines.push(headerName);
  if (businessAddress) {
    const addr = businessAddress.toString().substring(0, width);
    lines.push(addr.padStart(Math.floor((width + addr.length)/2)).padEnd(width));
  }
  lines.push(''.padEnd(width, '='));
  const folio = sale.numero_venta != null ? String(sale.numero_venta).padStart(4, '0') : (sale._id ? String(sale._id).slice(-6).toUpperCase() : 'N/A');
  lines.push('');
  lines.push(`${t.ticket}: ${folio}`);
  lines.push(`${t.fecha}: ${formatDate(sale.fecha, language)}`);
  lines.push(''.padEnd(width, '-'));

  // Desglose de métodos de pago
  if (sale.metodo_pago === 'mixto') {
    lines.push(t.metodo_pago_mixto);
    lines.push(''.padEnd(width, '-'));

    if (sale.efectivo_mxn > 0) {
      lines.push(`${t.efectivo_mxn}: ${formatCurrency(sale.efectivo_mxn, sale).padStart(width - 15)}`);
    }
    if (sale.efectivo_usd > 0) {
      const usdToMxn = sale.efectivo_usd * (sale.tipo_cambio || 20);
      lines.push(`${t.efectivo_usd}: ${formatCurrency(sale.efectivo_usd, sale).padStart(width - 15)}`);
      lines.push(`  ${t.equivalente_mxn}:   ${formatCurrency(usdToMxn, sale).padStart(width - 15)}`);
    }
    if (sale.tarjeta_credito > 0) {
      lines.push(`${t.tarjeta_credito}: ${formatCurrency(sale.tarjeta_credito, sale).padStart(width - 18)}`);
    }
    if (sale.tarjeta_debito > 0) {
      lines.push(`${t.tarjeta_debito}: ${formatCurrency(sale.tarjeta_debito, sale).padStart(width - 18)}`);
    }

    if (sale.tipo_cambio) {
      lines.push(''.padEnd(width, '-'));
      lines.push(`${t.tipo_cambio}: 1 USD = $${sale.tipo_cambio.toFixed(2)}`);
    }
  } else if (sale.metodo_pago === 'dolar') {
    lines.push(t.metodo_pago_usd);
    lines.push(''.padEnd(width, '-'));
    if (sale.monto_dolar) {
      lines.push(`${t.monto_usd}: ${formatCurrency(sale.monto_dolar, sale).padStart(width - 13)}`);
    }
    if (sale.dolar_recibido) {
      lines.push(`${t.recibido_usd}: ${formatCurrency(sale.dolar_recibido, sale).padStart(width - 15)}`);
    }
    if (sale.cambio_pesos !== null && sale.cambio_pesos !== undefined) {
      lines.push(`${t.cambio_mxn}: ${formatCurrency(sale.cambio_pesos, sale).padStart(width - 14)}`);
    }
    if (sale.tipo_cambio) {
      lines.push(''.padEnd(width, '-'));
      lines.push(`${t.tipo_cambio}: 1 USD = $${sale.tipo_cambio.toFixed(2)}`);
    }
  } else if (sale.metodo_pago === 'tarjeta') {
    lines.push(`${t.metodo_pago_tarjeta}`);
    if (sale.tipo_tarjeta) {
      lines.push(''.padEnd(width, '-'));
      lines.push(`${t.tipo}: ${sale.tipo_tarjeta.toUpperCase()}`);
    }
  } else {
    lines.push(`PAYMENT METHOD: ${sale.metodo_pago.toUpperCase()}`);
  }

  lines.push(''.padEnd(width, '-'));

  // Detalles de productos
  lines.push(`${t.cant.padEnd(4)}${t.producto.padEnd(20)}${t.precio.padStart(8)}${t.importe.padStart(8)}`);
  lines.push(''.padEnd(width, '-'));

  for (const detail of sale.detalles) {
    const cantidad = detail.cantidad.toString().padEnd(4);
    const nombreProducto = detail.producto_nombre || detail.producto_id?.nombre || 'Producto';
    const nombre = nombreProducto.substring(0, 20).padEnd(20);
    const precio = formatCurrency(detail.precio, sale).padStart(8);
    const importe = formatCurrency(detail.importe, sale).padStart(8);
    lines.push(`${cantidad}${nombre}${precio}${importe}`);

    // Agregar descuento si existe
    if (detail.descuento && detail.descuento > 0) {
      const discountAmount = detail.precio * (detail.descuento / 100) * detail.cantidad;
      lines.push(`     ${t.descuento}: -${detail.descuento}% -${formatCurrency(discountAmount, sale).padStart(8)}`);
    }

    // Agregar personalizaciones si existen
    if (detail.personalizaciones) {
      const customText = getCustomizationText(detail.personalizaciones);
      if (customText) {
        lines.push(`     ${customText.substring(0, 35)}`);
      }
    }
  }

  lines.push(''.padEnd(width, '-'));

  // Totales
  lines.push(`${t.subtotal}: ${formatCurrency(sale.subtotal, sale).padStart(width - 11)}`);
  const ivaRate = sale.iva_rate || 0.16;
  lines.push(`${t.iva} (${(ivaRate * 100).toFixed(0)}%): ${formatCurrency(sale.impuestos, sale).padStart(width - 11)}`);
  lines.push(''.padEnd(width, '='));
  lines.push(`${t.total}: ${formatCurrency(sale.total, sale).padStart(width - 8)}`);
  lines.push(''.padEnd(width, '='));

  // Pie de página
  lines.push('');
  lines.push(t.gracias.padStart(width / 2 + 10).padEnd(width));
  lines.push(t.desarrollado_por.padStart(width / 2 + 11).padEnd(width));
  lines.push(''.padEnd(width, '='));

  return lines.join('\n');
}

/**
 * Genera texto de personalizaciones para el ticket
 * @param {Object} personalizaciones - Objeto de personalizaciones
 * @returns {string} Texto formateado
 */
function getCustomizationText(personalizaciones) {
  if (!personalizaciones) return null;
  
  const parts = [];
  const p = personalizaciones;
  
  if (p.milkType && p.milkType.id !== 'entera') {
    parts.push(p.milkType.name);
  }
  
  if (p.toppings && p.toppings.length > 0) {
    parts.push(p.toppings.map(t => t.name).join(', '));
  }
  
  if (p.coldFoam && p.coldFoam.id !== 'none') {
    parts.push(p.coldFoam.name);
  }
  
  if (p.syrup && p.syrup.id !== 'none') {
    parts.push(p.syrup.name);
  }
  
  if (p.sweetness && p.sweetness.id !== '50') {
    parts.push(p.sweetness.name);
  }
  
  if (p.teaOption && p.teaOption.id !== 'hot') {
    parts.push(p.teaOption.name);
  }
  
  return parts.length > 0 ? parts.join(' • ') : null;
}

/**
 * Genera un ticket en formato ESC/POS (comandos de impresora)
 * @param {Object} sale - Venta con detalles
 * @returns {Buffer} Comandos ESC/POS
 */
export function generateESPOSTicket(sale) {
  // Esta es una implementación básica
  // Para producción, se recomienda usar una librería como escpos
  const text = generateTicket(sale);
  return Buffer.from(text, 'utf8');
}

/**
 * Formatea una fecha para el ticket
 * @param {string} dateString - Fecha en formato ISO
 * @param {string} language - Idioma ('es' o 'en')
 * @returns {string} Fecha formateada
 */
function formatDate(dateString, language = 'es') {
  const date = new Date(dateString);
  const locale = language === 'en' ? 'en-US' : 'es-MX';
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Formatea un valor monetario
 * @param {number} value - Valor a formatear
 * @param {Object} sale - Objeto de venta con info de moneda
 * @returns {string} Valor formateado como moneda
 */
function formatCurrency(value, sale) {
  const num = Number(value);
  const safe = Number.isFinite(num) ? num : 0;

  // Determinar moneda basada en la configuración de la venta
  let currency = 'MXN';
  if (sale.moneda_predeterminada) {
    currency = sale.moneda_predeterminada;
  } else if (sale.metodo_pago === 'dolar' || sale.metodo_pago === 'mixto') {
    currency = 'USD';
  }

  // Determinar locale basado en idioma de la venta
  const language = sale.idioma || 'es';
  const locale = language === 'en' ? 'en-US' : 'es-MX';

  if (currency === 'USD') {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(safe);
  }
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(safe);
}

/**
 * Simula la impresión de un ticket
 * @param {Object} sale - Venta con detalles
 * @returns {Object} Resultado de la impresión simulada
 */
export async function printTicket(sale, businessInfo = null) {
  try {
    const ticket = generateTicket(sale, businessInfo);
    
    // Simulación de impresión
    console.log('--- TICKET GENERADO ---');
    console.log(ticket);
    console.log('--- FIN DEL TICKET ---');

    return {
      success: true,
      ticket,
      message: 'Ticket generado exitosamente'
    };
  } catch (error) {
    console.error('Error al generar ticket:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
