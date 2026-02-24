// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// 🔥 IMPORTANT : désactiver package exports (Firebase / Hermes fix)
config.resolver.unstable_enablePackageExports = false;

// 🔥 Extensions supportées
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'cjs',
  'mjs',
];

// 🔥 Alias (ON NE TOUCHE PAS)
config.resolver.alias = {
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
};

// Optionnel
config.watcher.additionalExts = ['mjs', 'cjs'];

module.exports = config;
