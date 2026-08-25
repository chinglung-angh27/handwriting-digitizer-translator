
import React from 'react';
import type { Language } from '../types';
import { LANGUAGES } from '../constants';

interface LanguageSelectorProps {
  selectedLanguage: Language;
  onLanguageChange: (language: Language) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ selectedLanguage, onLanguageChange }) => {
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedLang = LANGUAGES.find(lang => lang.value === event.target.value);
    if (selectedLang) {
      onLanguageChange(selectedLang);
    }
  };

  return (
    <div>
      <label htmlFor="language-select" className="block text-sm font-medium text-slate-600 mb-2">
        Translate To:
      </label>
      <select
        id="language-select"
        value={selectedLanguage.value}
        onChange={handleChange}
        className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg py-3 px-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.value} value={lang.value}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
};