import { useState } from "react";

export default function LanguageSelector({ lang, setLang, style }) {
  return (
    <div className="flex gap-1 items-center" style={style}>
      <button
        className={`px-1 py-0.5 rounded text-xs ${lang === 'fr' ? 'bg-pink-600 text-white' : 'bg-gray-700 text-gray-300'} border-none shadow-none`}
        style={{ opacity: lang === 'fr' ? 0.7 : 0.4, background: lang === 'fr' ? '#ec4899' : 'transparent' }}
        onClick={() => setLang('fr')}
        aria-label="Français"
      >
        FR
      </button>
      <button
        className={`px-1 py-0.5 rounded text-xs ${lang === 'en' ? 'bg-pink-600 text-white' : 'bg-gray-700 text-gray-300'} border-none shadow-none`}
        style={{ opacity: lang === 'en' ? 0.7 : 0.4, background: lang === 'en' ? '#ec4899' : 'transparent' }}
        onClick={() => setLang('en')}
        aria-label="English"
      >
        EN
      </button>
    </div>
  );
}
