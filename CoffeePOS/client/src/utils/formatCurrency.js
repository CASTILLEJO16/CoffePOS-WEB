import { formatBusinessDateTime } from './dateTime.js';

const CURRENCY_KEY = 'moneda_predeterminada';

export function formatCurrency(value, currency) {
  const num = Number(value);
  const safe = Number.isFinite(num) ? num : 0;

  const selectedCurrency = currency || typeof window !== 'undefined' ? localStorage.getItem(CURRENCY_KEY) || 'MXN' : 'MXN';

  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: selectedCurrency,
    minimumFractionDigits: 2
  }).format(safe);
}

export function formatCurrencyWith(value, currency) {
  const num = Number(value);
  const safe = Number.isFinite(num) ? num : 0;

  const selectedCurrency = currency || typeof window !== 'undefined' ? localStorage.getItem(CURRENCY_KEY) || 'MXN' : 'MXN';

  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: selectedCurrency,
    minimumFractionDigits: 2
  }).format(safe);
}

/**
 * Formatea una fecha en zona America/Tijuana
 * @param {string|Date} date - Fecha a formatear
 * @returns {string} Fecha formateada
 */
export function formatDate(date) {
  return formatBusinessDateTime(date);
}
