import { createTamagui } from 'tamagui';
import { defaultConfig } from '@tamagui/config/v6';

// Propriétés de style en toutes lettres (padding, alignItems…) plutôt qu'en abréviations, et valeurs libres
// (couleurs hexadécimales de la maquette) : code plus lisible pour l'équipe.
const config = createTamagui({
  ...defaultConfig,
  settings: { ...defaultConfig.settings, onlyAllowShorthands: false, allowedStyleValues: false },
});

export type AppConfig = typeof config;
declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config;
