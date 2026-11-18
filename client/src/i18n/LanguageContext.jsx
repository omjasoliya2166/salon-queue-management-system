import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import en from './en.js';
import gu from './gu.js';

const translations = { en, gu };
const LanguageContext = createContext(null);

function resolveKey(obj, path) {
  return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      const saved = window.localStorage.getItem('sqms_lang');
      return saved === 'gu' ? 'gu' : 'en';
    } catch {
      return 'en';
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('sqms_lang', lang);
    } catch {
      // ignore storage errors
    }
    document.documentElement.lang = lang === 'gu' ? 'gu' : 'en';
  }, [lang]);

  const t = useCallback(
    (key, params = {}) => {
      const dict = translations[lang] || en;
      let text = resolveKey(dict, key);
      if (text === undefined) {
        text = resolveKey(en, key) ?? key;
      }
      if (typeof text !== 'string') return String(text);
      return text.replace(/\{(\w+)\}/g, (_, name) =>
        params[name] !== undefined ? String(params[name]) : `{${name}}`
      );
    },
    [lang]
  );

  const getLocalized = useCallback(
    (entity, baseField = 'name') => {
      if (!entity) return '';
      const guVal = entity[`${baseField}_gu`];
      const enVal = entity[`${baseField}_en`];
      if (lang === 'gu') return guVal || enVal || '';
      return enVal || guVal || '';
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, getLocalized }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
