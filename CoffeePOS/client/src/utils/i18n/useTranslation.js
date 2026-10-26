import { useContext, useEffect, useState } from 'react';
import { AuthContext } from './context/AuthContext';
import { translations } from './utils/i18n/translations.js';

const DEFAULT_LANGUAGE = 'es';

export function useTranslation(key) {
  const { user } = useContext(AuthContext);
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  
  useEffect(() => {
    // Try to get language from localStorage or user profile
    const storedLang = localStorage.getItem('idioma');
    if (storedLang) {
      setLanguage(storedLang);
    }
  }, []);
  
  // Get translation for key
  const translate = (key, defaults) => {
    const keyMap = translations[language]?.[key];
    if (keyMap) {
      return keyMap;
    }
    // Fallback: return the key in uppercase if not found
    return key ? key.replace(/([A-Z])/g, ' $1').trim() : '';
  };
  
  return translate(key, translations[DEFAULT_LANGUAGE]?.[key]);
}

/**
 * Get the current language code
 */
export function useLanguage() {
  const { user } = useContext(AuthContext);
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
    // Dispatch event so other parts of the app can react
    window.dispatchEvent(new Event('idiomaUpdated'));
    return true;
  } catch (e) {
    console.error('Error setting language:', e);
    return false;
  }
}