import { useEffect, useState } from 'react';
import { translations } from './translations.js';

const DEFAULT_LANGUAGE = 'es';

export function useTranslation() {
  const [language, setLanguage] = useState(
    () => localStorage.getItem('idioma') || DEFAULT_LANGUAGE
  );

  useEffect(() => {
    // Sync with any value already in storage (in case it changed externally)
    const storedLang = localStorage.getItem('idioma');
    if (storedLang && storedLang !== language) {
      setLanguage(storedLang);
    }

    const handleLanguageChange = () => {
      const newLang = localStorage.getItem('idioma');
      if (newLang) {
        setLanguage(newLang);
      }
    };

    window.addEventListener('idiomaUpdated', handleLanguageChange);
    return () => window.removeEventListener('idiomaUpdated', handleLanguageChange);
  }, []);

  const translate = (key) => {
    const keyMap = translations[language]?.[key];
    if (keyMap) {
      return keyMap;
    }
    // Fallback: format the key readable (e.g., "debES ABRIR UNA CAJA ANTES DE VENDER")
    return key ? key.replace(/([A-Z])/g, ' $1').trim() : '';
  };

  // Return both translate function and language to force re-renders
  return { t: translate, language };
}

/**
 * Get the current language code
 */
export function useLanguage() {
  const [language, setLanguage] = useState(
    () => localStorage.getItem('idioma') || DEFAULT_LANGUAGE
  );

  useEffect(() => {
    const storedLang = localStorage.getItem('idioma');
    if (storedLang && storedLang !== language) {
      setLanguage(storedLang);
    }

    const handleLanguageChange = () => {
      const newLang = localStorage.getItem('idioma');
      if (newLang) {
        setLanguage(newLang);
      }
    };

    window.addEventListener('idiomaUpdated', handleLanguageChange);
    return () => window.removeEventListener('idiomaUpdated', handleLanguageChange);
  }, []);

  return language;
}

/**
 * Get the current currency and listen for changes
 */
export function useCurrency() {
  const [currency, setCurrency] = useState(
    () => localStorage.getItem('moneda_predeterminada') || 'MXN'
  );

  useEffect(() => {
    const storedCurrency = localStorage.getItem('moneda_predeterminada');
    if (storedCurrency && storedCurrency !== currency) {
      setCurrency(storedCurrency);
    }

    const handleCurrencyChange = () => {
      const newCurrency = localStorage.getItem('moneda_predeterminada');
      if (newCurrency) {
        setCurrency(newCurrency);
      }
    };

    window.addEventListener('configUpdated', handleCurrencyChange);
    return () => window.removeEventListener('configUpdated', handleCurrencyChange);
  }, []);

  return currency;
}

/**
 * Set the language in config and localStorage
 */
export function setLanguage(lang) {
  try {
    localStorage.setItem('idioma', lang);
    window.dispatchEvent(new Event('idiomaUpdated'));
    return true;
  } catch (e) {
    console.error('Error setting language:', e);
    return false;
  }
}