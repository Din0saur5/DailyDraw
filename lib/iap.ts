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

const PURCHASE_TIMEOUT_MS = 2 * 60 * 1000;

let iapConnected = false;
let premiumProductCache: PremiumProductDetails | null = null;
let purchaseUpdateSubscription: RNIap.EventSubscription | null = null;
let purchaseErrorSubscription: RNIap.EventSubscription | null = null;

type PendingPurchase = {
  productId: string;
  resolve: (purchase: RNIap.Purchase) => void;
  reject: (error: Error) => void;
  timeout?: ReturnType<typeof setTimeout>;
};

let pendingPurchase: PendingPurchase | null = null;

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

const attachPurchaseListeners = () => {
  if (purchaseUpdateSubscription || purchaseErrorSubscription) return;
  purchaseUpdateSubscription = RNIap.purchaseUpdatedListener((purchase) => {
    if (
      !pendingPurchase ||
      purchase.productId !== pendingPurchase.productId ||
      (purchase.purchaseState !== 'purchased' && purchase.purchaseState !== 'restored')
    ) {
      return;
    }
    settlePendingPurchase({ purchase });
  });
  purchaseErrorSubscription = RNIap.purchaseErrorListener((error) => {
    if (!pendingPurchase) return;
    if (error.productId && error.productId !== pendingPurchase.productId) {
      return;
    }
    settlePendingPurchase({
      error: new Error(error.message || 'Apple was unable to complete this purchase.'),
    });
  });
};

const detachPurchaseListeners = () => {
  purchaseUpdateSubscription?.remove();
  purchaseErrorSubscription?.remove();
  purchaseUpdateSubscription = null;
  purchaseErrorSubscription = null;
};

const settlePendingPurchase = (result: { purchase?: RNIap.Purchase; error?: Error }) => {
  if (!pendingPurchase) return false;
  const current = pendingPurchase;
  pendingPurchase = null;
  if (current.timeout) {
    clearTimeout(current.timeout);
  }
  if (result.purchase) {
    current.resolve(result.purchase);
  } else if (result.error) {
    current.reject(result.error);
  }
  return true;
};

const waitForPurchase = (productId: string) => {
  if (pendingPurchase) {
    return Promise.reject(
      new Error('Another purchase is still being processed. Please try again in a moment.'),
    );
  }
  attachPurchaseListeners();
  return new Promise<RNIap.Purchase>((resolve, reject) => {
    pendingPurchase = {
      productId,
      resolve,
      reject,
      timeout: setTimeout(() => {
        settlePendingPurchase({
          error: new Error('Timed out while waiting for Apple to confirm the purchase.'),
        });
      }, PURCHASE_TIMEOUT_MS),
    };
  });
};

const cancelPendingPurchase = (reason?: Error | string) => {
  if (!pendingPurchase) return;
  const error = reason instanceof Error ? reason : new Error(reason ?? 'Purchase cancelled.');
  settlePendingPurchase({ error });
};

const formatTransactionDate = (timestamp?: number | string | null) => {
  if (timestamp === undefined || timestamp === null) return null;
  const numeric = typeof timestamp === 'string' ? Number(timestamp) : timestamp;
  if (!Number.isFinite(numeric)) return null;
  const asDate = new Date(numeric);
  return Number.isNaN(asDate.getTime()) ? null : asDate.toISOString();
};

const resolveTransactionId = (purchase: RNIap.Purchase) => {
  if ('originalTransactionIdentifierIOS' in purchase && purchase.originalTransactionIdentifierIOS) {
    return purchase.originalTransactionIdentifierIOS;
  }
  if ('transactionId' in purchase && purchase.transactionId) {
    return purchase.transactionId;
  }
  return null;
};

const fetchReceiptData = async (): Promise<string | null> => {
  if (Platform.OS !== 'ios') return null;
  try {
    const receipt = await RNIap.getReceiptIOS();
    if (receipt) return receipt;
  } catch (error) {
    console.warn('[iap] Unable to read Apple receipt', error);
  }
  try {
    await RNIap.requestReceiptRefreshIOS();
    return (await RNIap.getReceiptIOS()) ?? null;
  } catch (error) {
    console.warn('[iap] Receipt refresh failed', error);
    return null;
  }
};

export const initIapConnection = async () => {
  if (!shouldUseNativeIap() || iapConnected) return;
  await RNIap.initConnection();
  attachPurchaseListeners();
  iapConnected = true;
};

export const endIapConnection = async () => {
  if (!iapConnected) return;
  await RNIap.endConnection();
  detachPurchaseListeners();
  cancelPendingPurchase('StoreKit connection closed.');
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

export const purchasePremium = async (): Promise<PurchaseShape> => {
  if (!shouldUseNativeIap() || !env.iapProductId) {
    if (__DEV__) {
      return fallbackPurchase();
    }
    throw new Error('In-app purchases are not available on this build. Missing product ID.');
  }
  await initIapConnection();
  await loadPremiumProductDetails().catch(() => null);
  const purchasePromise = waitForPurchase(env.iapProductId);
  try {
    await RNIap.requestPurchase({
      type: 'subs',
      request: {
        ios: {
          sku: env.iapProductId,
          andDangerouslyFinishTransactionAutomatically: false,
        },
      },
    });
  } catch (error) {
    cancelPendingPurchase(error instanceof Error ? error : String(error));
    throw error;
  }
  const purchase = await purchasePromise;
  await RNIap.finishTransaction({ purchase, isConsumable: false });
  const receiptData = await fetchReceiptData();
  if (!receiptData) {
    throw new Error('Apple did not return a receipt for this purchase. Please try again.');
  }
  return {
    productId: purchase.productId ?? env.iapProductId,
    transactionId: resolveTransactionId(purchase),
    transactionDate: formatTransactionDate(purchase.transactionDate),
    receiptData,
  };
};

export const restorePremium = async (): Promise<PurchaseShape | null> => {
  if (!shouldUseNativeIap() || !env.iapProductId) {
    if (__DEV__) {
      return fallbackPurchase();
    }
    throw new Error('In-app purchases are not available on this build. Missing product ID.');
  }
  await initIapConnection();
  await loadPremiumProductDetails().catch(() => null);
  const purchases = await RNIap.getAvailablePurchases({
    alsoPublishToEventListenerIOS: false,
    onlyIncludeActiveItemsIOS: true,
  });
  const premiumPurchase = purchases.find((item) => {
    if (item.productId === env.iapProductId) return true;
    return Array.isArray(item.ids) && item.ids.includes(env.iapProductId);
  });
  if (!premiumPurchase) return null;
  const receiptData = await fetchReceiptData();
  if (!receiptData) {
    throw new Error('Apple could not locate a receipt to restore. Try purchasing again.');
  }
  return {
    productId: premiumPurchase.productId ?? env.iapProductId,
    transactionId: resolveTransactionId(premiumPurchase),
    transactionDate: formatTransactionDate(premiumPurchase.transactionDate),
    receiptData,
  };
};
