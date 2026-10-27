import { useEffect, useState } from 'react';
import { translations } from './translations.js';

const DEFAULT_LANGUAGE = 'es';

export function useTranslation() {
  const translate = (key) => {
    const language = localStorage.getItem('idioma') || DEFAULT_LANGUAGE;
    const keyMap = translations[language]?.[key];
    if (keyMap) {
      return keyMap;
    }
    return key ? key.replace(/([A-Z])/g, ' $1').trim() : '';
  };

  return translate;
}

/**
 * Get the current language code
 */
export function useLanguage() {
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);

  useEffect(() => {
    const storedLang = localStorage.getItem('idioma');
    if (storedLang) {
      setLanguage(storedLang);
    }
  }, []);

  return language;
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