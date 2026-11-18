import React from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function LanguageToggle({ compact = false }) {
  const { lang, setLang } = useLanguage();

  return (
    <div
      className="inline-flex items-center rounded-xl bg-salon-dark/90 border border-white/15 p-1"
      role="group"
      aria-label="Language switcher"
    >
      {!compact && <Globe className="w-3.5 h-3.5 text-salon-gold ml-1.5 mr-1 hidden sm:block" />}
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`px-2.5 py-1 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
          lang === 'en'
            ? 'bg-salon-gold text-salon-dark shadow-sm'
            : 'text-gray-300 hover:text-white'
        }`}
      >
        English
      </button>
      <button
        type="button"
        onClick={() => setLang('gu')}
        className={`px-2.5 py-1 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
          lang === 'gu'
            ? 'bg-salon-gold text-salon-dark shadow-sm'
            : 'text-gray-300 hover:text-white'
        }`}
      >
        ગુજરાતી
      </button>
    </div>
  );
}
