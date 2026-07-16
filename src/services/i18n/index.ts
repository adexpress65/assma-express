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
import de from './resources/de.json';
import it from './resources/it.json';
import nl from './resources/nl.json';
import ko from './resources/ko.json';
import vi from './resources/vi.json';

import { SUPPORTED_LANGUAGES } from './languages';
import { applyLayoutDirectionForLanguage } from '../../utils/layoutDirection';

const languageDetector = {
  type: 'languageDetector',
  async: true,
  detect: async (callback: (lang: string) => void) => {
    try {
      const saved = await AsyncStorage.getItem('app-language');
      callback(saved && saved.length > 0 ? saved : 'en');
    } catch {
      callback('en');
    }
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
      defaultNS: 'translation',
      ns: ['translation'],
      /** Toutes les langues sont fournies dans `resources` : laisser à false évite un chargement « partiel » qui bloque la résolution des clés (affichage brut type `app.tabs.home`). */
      partialBundledLanguages: false,
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
        de: { translation: de },
        it: { translation: it },
        nl: { translation: nl },
        ko: { translation: ko },
        vi: { translation: vi },
      },
      /** Clés absentes d’un fichier partiel → texte anglais (évite les clés nues). */
      fallbackLng: ['en'],
      supportedLngs: SUPPORTED_LANGUAGES.map(l => l.code),
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });
}

/** Changement de langue + direction LTR/RTL (retour arabe → anglais inclus). */
export async function changeLanguage(languageCode: string): Promise<void> {
  await i18n.changeLanguage(languageCode);
  applyLayoutDirectionForLanguage(languageCode);
}

export default i18n;
