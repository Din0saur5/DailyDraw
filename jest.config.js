const config = {
  preset: 'jest-expo',
  testEnvironment: 'jsdom',
  setupFiles: ['./jest.setup.js'],
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-navigation|expo(nent)?|@expo|expo-router|@expo-google-fonts|@supabase)',
  ],
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
};

module.exports = config;
