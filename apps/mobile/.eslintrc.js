module.exports = {
  root: true,
  extends: [
    'expo',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    // Bloque les nouveaux `any` explicites — toujours préférer un type précis
    '@typescript-eslint/no-explicit-any': 'warn',
    // Bloque les variables non utilisées
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    // Préfère les types d'import explicites
    '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
  },
  ignorePatterns: [
    'node_modules/',
    '.expo/',
    'dist/',
    'android/',
    'ios/',
    'App_*.tsx',
    'imports-map.txt',
    'diagnostic-exports.txt',
  ],
};
