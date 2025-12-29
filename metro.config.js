// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Obtenir la configuration par défaut
const config = getDefaultConfig(__dirname);

// Ajouter la configuration des alias
config.resolver = {
  ...config.resolver,
  alias: {
    // Alias principaux
    '@': path.resolve(__dirname, 'src'),
    '@components': path.resolve(__dirname, 'src/components'),
    '@screens': path.resolve(__dirname, 'src/screens'),
    '@services': path.resolve(__dirname, 'src/services'),
    '@config': path.resolve(__dirname, 'src/config'),
    '@hooks': path.resolve(__dirname, 'src/hooks'),
    '@contexts': path.resolve(__dirname, 'src/contexts'),
    '@assets': path.resolve(__dirname, 'src/assets'),
    '@utils': path.resolve(__dirname, 'src/utils'),
    '@types': path.resolve(__dirname, 'src/types'),
  },
  // S'assurer que les extensions sont bien résolues
  sourceExts: [...config.resolver.sourceExts, 'cjs', 'mjs'],
};

// Optionnel: améliorer le watch
config.watcher.additionalExts = ['mjs', 'cjs'];

module.exports = config;