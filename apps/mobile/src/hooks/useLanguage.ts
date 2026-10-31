// apps/mobile/src/hooks/useLanguage.ts
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, Language } from '../services/i18n/languages';
import { changeLanguage } from '../services/i18n';

export const useLanguage = () => {
  const { i18n } = useTranslation();
  const [currentLang, setCurrentLang] = useState<Language>(
    SUPPORTED_LANGUAGES.find(lang => lang.code === i18n.language) || SUPPORTED_LANGUAGES[0]
  );

  // Écouter les changements de langue
  useEffect(() => {
    const handleLanguageChange = (event: any) => {
      const newLangCode = event.detail?.language || i18n.language;
      const newLang = SUPPORTED_LANGUAGES.find(lang => lang.code === newLangCode);
      if (newLang) {
        setCurrentLang(newLang);
      }
    };

    // Écouter l'événement personnalisé
    window.addEventListener('app:languageChanged', handleLanguageChange);
    
    // Écouter les changements i18n
    const handleI18nChange = () => {
      const lang = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language);
      if (lang) {
        setCurrentLang(lang);
      }
    };
    
    i18n.on('languageChanged', handleI18nChange);
    
    return () => {
      window.removeEventListener('app:languageChanged', handleLanguageChange);
      i18n.off('languageChanged', handleI18nChange);
    };
  }, [i18n]);

  // Fonction pour changer de langue
  const switchLanguage = useCallback(async (languageCode: string) => {
    try {
      await changeLanguage(languageCode);
      return true;
    } catch (error) {
      console.error('Failed to switch language:', error);
      return false;
    }
  }, []);

  return {
    currentLanguage: currentLang,
    supportedLanguages: SUPPORTED_LANGUAGES,
    switchLanguage,
    isRTL: currentLang.code === 'ar',
  };
};
