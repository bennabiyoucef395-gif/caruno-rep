// Multilingue : français (par défaut), arabe (écriture de droite à gauche), anglais.
// La langue se choisit dans Paramètres ; au premier lancement on prend celle de l'appareil si elle est proposée.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { I18nManager, Platform } from 'react-native';
import { fr, ar, en } from './locales';

export const LANGUAGES = [
  { code: 'fr', label: 'Français', rtl: false },
  { code: 'ar', label: 'العربية', rtl: true },
  { code: 'en', label: 'English', rtl: false },
] as const;
export type Lang = (typeof LANGUAGES)[number]['code'];

export function deviceLanguage(): Lang {
  const code = (getLocales()[0]?.languageCode || 'fr') as string;
  return (LANGUAGES.find((l) => l.code === code)?.code || 'fr') as Lang;
}

export const isRtl = (lang: string) => !!LANGUAGES.find((l) => l.code === lang)?.rtl;

i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, ar: { translation: ar }, en: { translation: en } },
  lng: 'fr',
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
  returnNull: false,
});

// Applique la langue : textes tout de suite ; sens de lecture via l'attribut dir sur le web,
// via I18nManager sur mobile (pris en compte au redémarrage de l'app).
export function applyLanguage(lang: Lang): { needsRestart: boolean } {
  i18n.changeLanguage(lang);
  const rtl = isRtl(lang);
  if (Platform.OS === 'web') {
    const root = globalThis.document?.documentElement;
    if (root) { root.setAttribute('dir', rtl ? 'rtl' : 'ltr'); root.setAttribute('lang', lang); }
    return { needsRestart: false };
  }
  if (I18nManager.isRTL !== rtl) { I18nManager.allowRTL(rtl); I18nManager.forceRTL(rtl); return { needsRestart: true }; }
  return { needsRestart: false };
}

export default i18n;
