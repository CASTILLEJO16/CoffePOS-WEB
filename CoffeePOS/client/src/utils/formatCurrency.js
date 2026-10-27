import { formatBusinessDateTime } from './dateTime.js';

const CURRENCY_KEY = 'moneda_predeterminada';
const LANGUAGE_KEY = 'idioma';

function getLocale() {
  if (typeof window === 'undefined') return 'es-MX';
  const language = localStorage.getItem(LANGUAGE_KEY) || 'es';
  return language === 'en' ? 'en-US' : 'es-MX';
}

export function formatCurrency(value, currency) {
  const num = Number(value);
  const safe = Number.isFinite(num) ? num : 0;

  const selectedCurrency = currency || typeof window !== 'undefined' ? localStorage.getItem(CURRENCY_KEY) || 'MXN' : 'MXN';
  const locale = getLocale();

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: selectedCurrency,
    minimumFractionDigits: 2
  }).format(safe);
}

export function formatCurrencyWith(value, currency) {
  const num = Number(value);
  const safe = Number.isFinite(num) ? num : 0;

  const selectedCurrency = currency || typeof window !== 'undefined' ? localStorage.getItem(CURRENCY_KEY) || 'MXN' : 'MXN';
  const locale = getLocale();

  return new Intl.NumberFormat(locale, {
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
