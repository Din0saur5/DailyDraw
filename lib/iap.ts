import { Platform } from 'react-native';
import * as RNIap from 'react-native-iap';

import { env } from '@/lib/env';

type PurchaseShape = {
  productId: string | null;
  transactionId: string | null;
  transactionDate?: string | null;
  receiptData?: string | null;
};

export type PremiumProductDetails = {
  id: string;
  title: string;
  description: string;
  displayPrice: string | null;
  currency: string | null;
};

let iapConnected = false;
let premiumProductCache: PremiumProductDetails | null = null;

const shouldUseNativeIap = () => Platform.OS === 'ios' && Boolean(env.iapProductId);

const fallbackPurchase = (): PurchaseShape => ({
  productId: env.iapProductId || 'com.dailydraw.premium.dev',
  transactionId: `dev-${Date.now()}`,
  transactionDate: new Date().toISOString(),
  receiptData: `dev-receipt-${Date.now()}`,
});

const mapProductDetails = (
  product: RNIap.ProductSubscription | RNIap.Product,
): PremiumProductDetails => ({
  id: 'productId' in product && product.productId ? product.productId : product.id,
  title: product.title,
  description: product.description,
  displayPrice: product.displayPrice ?? (product as any).localizedPrice ?? null,
  currency: product.currency ?? null,
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
  premiumProductCache = null;
};

export const loadPremiumProductDetails = async (): Promise<PremiumProductDetails | null> => {
  if (!shouldUseNativeIap() || !env.iapProductId) {
    return null;
  }
  if (premiumProductCache && premiumProductCache.id === env.iapProductId) {
    return premiumProductCache;
  }
  await initIapConnection();
  try {
    const result = await RNIap.fetchProducts({
      skus: [env.iapProductId],
      type: 'subs',
    });
    const products = Array.isArray(result) ? result : [];
    const match = products.find((item) => {
      const productId = 'productId' in item && item.productId ? item.productId : item.id;
      return productId === env.iapProductId;
    });
    if (!match) return null;
    premiumProductCache = mapProductDetails(match);
    return premiumProductCache;
  } catch (error) {
    console.warn('[iap] Failed to load premium product', error);
    return null;
  }
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
  await loadPremiumProductDetails().catch(() => null);
  const purchase = await RNIap.requestSubscription(env.iapProductId);
  await RNIap.finishTransaction(purchase, true);
  return {
    productId: purchase.productId ?? env.iapProductId,
    transactionId: resolveTransactionId(purchase),
    transactionDate: purchase.transactionDate ?? null,
    receiptData: purchase.transactionReceipt ?? null,
  };
};

export const restorePremium = async (): Promise<PurchaseShape | null> => {
  if (!shouldUseNativeIap() || !env.iapProductId) {
    return fallbackPurchase();
  }
  await initIapConnection();
  await loadPremiumProductDetails().catch(() => null);
  const purchases = await RNIap.getAvailablePurchases();
  const premiumPurchase = purchases.find((item) => item.productId === env.iapProductId);
  if (!premiumPurchase) return null;
  return {
    productId: premiumPurchase.productId ?? env.iapProductId,
    transactionId: resolveTransactionId(premiumPurchase),
    transactionDate: premiumPurchase.transactionDate ?? null,
    receiptData: premiumPurchase.transactionReceipt ?? null,
  };
};
