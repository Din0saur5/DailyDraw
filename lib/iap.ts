import { Platform } from 'react-native';
import * as RNIap from 'react-native-iap';

import { env } from '@/lib/env';

type PurchaseShape = {
  productId: string | null;
  transactionId: string | null;
  transactionDate?: string | null;
};

let iapConnected = false;

const shouldUseNativeIap = () => Platform.OS === 'ios' && Boolean(env.iapProductId);

const fallbackPurchase = (): PurchaseShape => ({
  productId: env.iapProductId || 'com.dailydraw.premium.dev',
  transactionId: `dev-${Date.now()}`,
  transactionDate: new Date().toISOString(),
});

export const initIapConnection = async () => {
  if (!shouldUseNativeIap() || iapConnected) return;
  await RNIap.initConnection();
  iapConnected = true;
};

export const endIapConnection = async () => {
  if (!iapConnected) return;
  await RNIap.endConnection();
  iapConnected = false;
};

const resolveTransactionId = (purchase: RNIap.SubscriptionPurchase | RNIap.ProductPurchase) =>
  purchase.transactionId ??
  purchase.transactionIdIOS ??
  purchase.originalTransactionIdentifierIOS ??
  null;

export const purchasePremium = async (): Promise<PurchaseShape> => {
  if (!shouldUseNativeIap() || !env.iapProductId) {
    return fallbackPurchase();
  }
  await initIapConnection();
  const purchase = await RNIap.requestSubscription(env.iapProductId);
  await RNIap.finishTransaction(purchase, true);
  return {
    productId: purchase.productId ?? env.iapProductId,
    transactionId: resolveTransactionId(purchase),
    transactionDate: purchase.transactionDate ?? null,
  };
};

export const restorePremium = async (): Promise<PurchaseShape | null> => {
  if (!shouldUseNativeIap() || !env.iapProductId) {
    return fallbackPurchase();
  }
  await initIapConnection();
  const purchases = await RNIap.getAvailablePurchases();
  const premiumPurchase = purchases.find((item) => item.productId === env.iapProductId);
  if (!premiumPurchase) return null;
  return {
    productId: premiumPurchase.productId ?? env.iapProductId,
    transactionId: resolveTransactionId(premiumPurchase),
    transactionDate: premiumPurchase.transactionDate ?? null,
  };
};
