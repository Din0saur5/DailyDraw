if (process.env.EXPO_PUBLIC_SUPABASE_URL == null) {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
}

if (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY == null) {
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
}

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
