import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';

const i18n = new I18n({
  fr: {
    welcome: "Bienvenue",
    login: "Connexion",
    logout: "Déconnexion",
  },
  en: {
    welcome: "Welcome",
    login: "Login",
    logout: "Logout",
  },
});

i18n.enableFallback = true;
i18n.defaultLocale = 'fr';
i18n.locale = Localization.locale.split('-')[0];

export default i18n;
