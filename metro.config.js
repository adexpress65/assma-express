const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = false;

config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs', 'mjs'];

// Détection du mode Web
const isWeb = process.argv.includes('--web');

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

  // 🚨 FORCE LE REPLACEMENT ICI
  ...(isWeb ? { 
    'react-native-webrtc': path.resolve(__dirname, 'react-native-webrtc.web.js') 
  } : {}),
};

module.exports = config;