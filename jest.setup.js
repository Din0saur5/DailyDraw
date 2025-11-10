if (process.env.EXPO_PUBLIC_SUPABASE_URL == null) {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
}

if (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY == null) {
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
}

if (process.env.EXPO_PUBLIC_IAP_PRODUCT_ID == null) {
  process.env.EXPO_PUBLIC_IAP_PRODUCT_ID = 'test-product';
}

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-iap', () => ({
  initConnection: jest.fn().mockResolvedValue(true),
  endConnection: jest.fn().mockResolvedValue(true),
  requestSubscription: jest.fn().mockResolvedValue({
    productId: 'test-product',
    transactionId: 'txn-123',
    transactionDate: new Date().toISOString(),
  }),
  getAvailablePurchases: jest.fn().mockResolvedValue([]),
  finishTransaction: jest.fn().mockResolvedValue(undefined),
}));
