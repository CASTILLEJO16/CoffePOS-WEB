/**
 * Utilidades compartidas por el ticket y las etiquetas.
 */

// ---------- Tamaños de papel ----------

export const TICKET_WIDTHS = {
  '80': { label: '80 mm (el más común)', paper: 80, printable: 72 },
  '58': { label: '58 mm (impresora chica)', paper: 58, printable: 48 },
  '110': { label: '110 mm (como estaba antes)', paper: 110, printable: 100 }
};

export const LABEL_SIZES = {
  '50x25': { label: '50.8 × 25.4 mm (2" × 1", el más común)', w: 50.8, h: 25.4 },
  '50x30': { label: '50 × 30 mm', w: 50, h: 30 },
  '40x30': { label: '40 × 30 mm', w: 40, h: 30 },
  '58x40': { label: '58 × 40 mm', w: 58, h: 40 }
};

const readLocal = (k) => { try { return localStorage.getItem(k); } catch { return null; } };

/** Ajustes de impresión (se guardan en Configuración y se cachean en el navegador). */
export function getPrintSettings() {
  const ticket = TICKET_WIDTHS[readLocal('ticket_ancho')] ? readLocal('ticket_ancho') : '80';
  const label = LABEL_SIZES[readLocal('etiqueta_tamano')] ? readLocal('etiqueta_tamano') : '50x25';
  return { ticket: TICKET_WIDTHS[ticket], ticketKey: ticket, label: LABEL_SIZES[label], labelKey: label };
}

/** Guarda en el navegador los ajustes que vienen de la configuración del servidor. */
export function cachePrintSettings(config) {
  if (!config) return;
  try {
    if (config.ticket_ancho && TICKET_WIDTHS[config.ticket_ancho]) localStorage.setItem('ticket_ancho', config.ticket_ancho);
    if (config.etiqueta_tamano && LABEL_SIZES[config.etiqueta_tamano]) localStorage.setItem('etiqueta_tamano', config.etiqueta_tamano);
  } catch { /* modo privado */ }
}

// ---------- Personalizaciones ----------

// Valores "por defecto" del formato viejo que no vale la pena imprimir
const LEGACY_DEFAULTS = { milkType: 'entera', coldFoam: 'none', syrup: 'none', sweetness: '50', teaOption: 'hot' };
const SKIP_KEYS = new Set(['isCombo', 'comboProducts', 'comboId', 'precio', 'price', 'notas', 'nota']);

function optionName(opt) {
  if (opt == null) return null;
  if (typeof opt === 'string') {
    // A veces llega un objeto serializado como texto
    const m = opt.match(/"name":"([^"]+)"/);
    return (m ? m[1] : opt).trim() || null;
  }
  if (typeof opt === 'object') {
    const n = opt.name || opt.nombre || opt.label || opt.descripcion;
    return n ? String(n).trim() : null;
  }
  return null;
}

/**
 * Lista de personalizaciones elegidas: [{ tipo, name, price }].
 * Soporta el formato actual ({ leche: [{name, price}], topping: [...] })
 * y el viejo ({ milkType: {...}, toppings: [...] }).
 */
export function getCustomizationList(personalizaciones) {
  let p = personalizaciones;
  if (!p) return [];
  if (typeof p === 'string') {
    try { p = JSON.parse(p); } catch { return []; }
  }
  if (typeof p !== 'object') return [];

  const out = [];
  for (const [tipo, value] of Object.entries(p)) {
    if (SKIP_KEYS.has(tipo) || value == null || value === '') continue;
    const list = Array.isArray(value) ? value : [value];
    for (const opt of list) {
      if (opt && typeof opt === 'object' && LEGACY_DEFAULTS[tipo] && opt.id === LEGACY_DEFAULTS[tipo]) continue;
      const name = optionName(opt);
      if (!name || ['none', 'default', 'null', 'undefined'].includes(name.toLowerCase())) continue;
      const price = Number(opt?.price ?? opt?.precio_adicional ?? 0) || 0;
      out.push({ tipo, name, price });
    }
  }
  return out;
}

/** Nota libre del producto, si la hay. */
export function getItemNote(detail) {
  let p = detail?.personalizaciones;
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch { p = null; } }
  const note = detail?.notas || detail?.nota || p?.notas || p?.nota;
  return note ? String(note).trim() : null;
}

// ---------- Escape ----------

export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- Abrir el diálogo de impresión ----------

/**
 * Imprime un documento HTML completo.
 * Usa una ventana nueva; si el navegador la bloquea (pasa en tablets después de cobrar),
 * imprime desde un iframe oculto. Espera a que el documento esté listo (antes a veces
 * el evento onload ya había pasado y no se imprimía nada).
 */
export function printHtmlDocument(html, { closeDelay = 500 } = {}) {
  const run = (win, cleanup) => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      try {
        // El documento puede traer un ajuste previo (ej. achicar texto de etiquetas)
        if (typeof win.__beforePrint === 'function') win.__beforePrint();
      } catch { /* sin ajuste */ }
      let cleaned = false;
      const finish = () => { if (!cleaned) { cleaned = true; cleanup(); } };
      // En celular/tablet print() no bloquea: cerrar antes de tiempo cancela la impresión.
      // Se cierra al terminar (afterprint) o, en escritorio, en cuanto regresa print().
      try { win.addEventListener('afterprint', () => setTimeout(finish, closeDelay)); } catch { /* sin evento */ }
      const t0 = Date.now();
      try { win.focus(); win.print(); } catch (e) { console.error('No se pudo imprimir:', e); }
      if (Date.now() - t0 > 300) setTimeout(finish, closeDelay); // el diálogo bloqueó: ya terminó
      else setTimeout(finish, 120000);                            // respaldo
    };
    if (win.document.readyState === 'complete') setTimeout(go, 50);
    else {
      win.addEventListener('load', () => setTimeout(go, 50));
      setTimeout(go, 1500); // respaldo por si 'load' nunca llega
    }
  };

  const w = window.open('', '_blank', 'width=420,height=640');
  if (w && w.document) {
    w.document.open();
    w.document.write(html);
    w.document.close();
    run(w, () => { try { w.close(); } catch { /* ya cerrada */ } });
    return true;
  }

  // Ventana bloqueada: iframe invisible
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  run(iframe.contentWindow, () => { try { iframe.remove(); } catch { /* ya removido */ } });
  return true;
}
