import i18n from './index';

export function useTranslation() {
  return {
    t: (key, options) => i18n.t(key, options),
  };
}
