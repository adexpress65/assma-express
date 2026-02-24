import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 🔹 IMPORTS DES LANGUES
import en from './resources/en.json';
import fr from './resources/fr.json';
import ar from './resources/ar.json';
import es from './resources/es.json';
import pt from './resources/pt.json';
import ru from './resources/ru.json';
import zh from './resources/zh.json';
import ja from './resources/ja.json';
import tr from './resources/tr.json';
import id from './resources/id.json';


import { SUPPORTED_LANGUAGES } from './languages';

const languageDetector = {
  type: 'languageDetector',
  async: true,
  detect: async (callback: (lang: string) => void) => {
    const saved = await AsyncStorage.getItem('app-language');
    callback(saved || 'en');
  },
  init: () => {},
  cacheUserLanguage: (lang: string) => {
    AsyncStorage.setItem('app-language', lang);
  },
};

if (!i18n.isInitialized) {
  i18n
    .use(languageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        fr: { translation: fr },
        ar: { translation: ar },
        es: { translation: es },
        pt: { translation: pt },
        ru: { translation: ru },
        zh: { translation: zh },
        ja: { translation: ja },
        tr: { translation: tr },
        id: { translation: id },
      },
      fallbackLng: 'en',
      supportedLngs: SUPPORTED_LANGUAGES.map(l => l.code),
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });
}

export default i18n;
