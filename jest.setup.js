require('dotenv').config();

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

jest.mock('react-native-iap', () => {
  const listeners = {
    purchase: undefined,
    error: undefined,
  };

  const buildMockPurchase = () => ({
    id: 'txn-123',
    productId: 'test-product',
    transactionId: 'txn-123',
    transactionDate: Date.now(),
    purchaseState: 'purchased',
    isAutoRenewing: true,
    quantity: 1,
    platform: 'ios',
    purchaseToken: 'mock-token',
    originalTransactionIdentifierIOS: 'orig-123',
  });

  return {
    initConnection: jest.fn().mockResolvedValue(true),
    endConnection: jest.fn().mockResolvedValue(true),
    purchaseUpdatedListener: jest.fn((listener) => {
      listeners.purchase = listener;
      return {
        remove: jest.fn(() => {
          if (listeners.purchase === listener) {
            listeners.purchase = undefined;
          }
        }),
      };
    }),
    purchaseErrorListener: jest.fn((listener) => {
      listeners.error = listener;
      return {
        remove: jest.fn(() => {
          if (listeners.error === listener) {
            listeners.error = undefined;
          }
        }),
      };
    }),
    requestPurchase: jest.fn(async () => {
      listeners.purchase?.(buildMockPurchase());
    }),
    finishTransaction: jest.fn().mockResolvedValue(undefined),
    fetchProducts: jest.fn().mockResolvedValue([
      {
        id: 'test-product',
        productId: 'test-product',
        title: 'Premium Monthly',
        description: 'Full history access',
        displayPrice: '$4.99',
        currency: 'USD',
        type: 'subs',
        platform: 'ios',
      },
    ]),
    getAvailablePurchases: jest.fn().mockResolvedValue([buildMockPurchase()]),
    getReceiptIOS: jest.fn().mockResolvedValue('mock-receipt'),
    requestReceiptRefreshIOS: jest.fn().mockResolvedValue('mock-receipt'),
  };
});
