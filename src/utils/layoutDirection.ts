import { I18nManager } from 'react-native';
import { SUPPORTED_LANGUAGES } from '@/services/i18n/languages';

/**
 * Direction d’affichage attendue pour un code i18next (ex. `en`, `fr`, `ar`, `zh-CN`).
 * S’appuie sur `SUPPORTED_LANGUAGES` (seul `ar` est RTL aujourd’hui).
 */
export function getDirectionForLanguageCode(lang: string | undefined): 'ltr' | 'rtl' {
  const short = (lang || 'en').split(/[-_]/)[0]?.toLowerCase() ?? 'en';
  const found = SUPPORTED_LANGUAGES.find((l) => l.code === short);
  return found?.direction ?? 'ltr';
}

export function isRTLLanguage(lang: string | undefined): boolean {
  return getDirectionForLanguageCode(lang) === 'rtl';
}

/**
 * Synchronise `I18nManager` avec la langue active. Indispensable quand on quitte l’arabe (RTL)
 * pour une langue LTR : sans `forceRTL(false)`, la barre d’onglets et le reste restent inversés.
 */
export function applyLayoutDirectionForLanguage(lang: string | undefined): void {
  const wantRTL = isRTLLanguage(lang);
  if (wantRTL) {
    if (!I18nManager.isRTL) {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(true);
    }
  } else if (I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(false);
  }
}
