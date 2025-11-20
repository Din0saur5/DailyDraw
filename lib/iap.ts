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
let iapConnectionPromise: Promise<void> | null = null;
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
  console.log('[iap] attaching purchase listeners');
  purchaseUpdateSubscription = RNIap.purchaseUpdatedListener((purchase) => {
    console.log('[iap] purchaseUpdatedListener fired', {
      productId: purchase.productId,
      state: (purchase as any).purchaseState,
    });
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
    console.log('[iap] purchaseErrorListener fired', {
      code: (error as any).code,
      message: error.message,
      productId: (error as any).productId,
    });
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
  console.log('[iap] detaching purchase listeners');
  purchaseUpdateSubscription?.remove();
  purchaseErrorSubscription?.remove();
  purchaseUpdateSubscription = null;
  purchaseErrorSubscription = null;
};

const settlePendingPurchase = (result: { purchase?: RNIap.Purchase; error?: Error }) => {
  if (!pendingPurchase) return false;
  console.log('[iap] settlePendingPurchase', {
    hasPurchase: Boolean(result.purchase),
    hasError: Boolean(result.error),
  });
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
  console.log('[iap] waiting for purchase', { productId });
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
  console.log('[iap] cancelPendingPurchase', { reason });
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
  if (!shouldUseNativeIap() || iapConnected) {
    if (!shouldUseNativeIap()) {
      console.log('[iap] skipping init: native iap not available', { platform: Platform.OS });
    }
    if (iapConnected) {
      console.log('[iap] init skipped: already connected');
    }
    return;
  }
  if (!iapConnectionPromise) {
    console.log('[iap] initConnection start');
    iapConnectionPromise = (async () => {
      const connected = await RNIap.initConnection();
      if (!connected) {
        throw new Error('Unable to connect to the App Store for purchases. Please try again.');
      }
      attachPurchaseListeners();
      iapConnected = true;
      console.log('[iap] initConnection success');
    })()
      .catch((error) => {
        console.warn('[iap] Failed to initialize native IAP connection', error);
        throw error;
      })
      .finally(() => {
        iapConnectionPromise = null;
        console.log('[iap] initConnection finished');
      });
  }
  await iapConnectionPromise;
};

export const endIapConnection = async () => {
  if (iapConnectionPromise) {
    try {
      await iapConnectionPromise;
    } catch {
      // swallow errors from a failed initialization attempt
    }
  }
  if (!iapConnected) return;
  await RNIap.endConnection();
  detachPurchaseListeners();
  cancelPendingPurchase('StoreKit connection closed.');
  iapConnected = false;
  premiumProductCache = null;
};

export const loadPremiumProductDetails = async (): Promise<PremiumProductDetails | null> => {
  if (!shouldUseNativeIap() || !env.iapProductId) {
    console.log('[iap] loadPremiumProductDetails skipped', {
      platform: Platform.OS,
      hasProduct: Boolean(env.iapProductId),
    });
    return null;
  }
  if (premiumProductCache && premiumProductCache.id === env.iapProductId) {
    console.log('[iap] returning cached product details', premiumProductCache);
    return premiumProductCache;
  }
  await initIapConnection();
  try {
    console.log('[iap] fetching product details', { sku: env.iapProductId });
    const result = await RNIap.fetchProducts({
      skus: [env.iapProductId],
      type: 'subs',
    });
    const products = Array.isArray(result) ? result : [];
    console.log('[iap] fetchProducts result count', products.length);
    const match = products.find((item) => {
      const productId = 'productId' in item && item.productId ? item.productId : item.id;
      return productId === env.iapProductId;
    });
    if (!match) {
      console.log('[iap] product not found in fetchProducts');
      return null;
    }
    premiumProductCache = mapProductDetails(match);
    console.log('[iap] product details cached', premiumProductCache);
    return premiumProductCache;
  } catch (error) {
    console.warn('[iap] Failed to load premium product', error);
    return null;
  }
};

export const purchasePremium = async (): Promise<PurchaseShape> => {
  if (!shouldUseNativeIap() || !env.iapProductId) {
    if (__DEV__) {
      console.log('[iap] falling back to mock purchase (dev)');
      return fallbackPurchase();
    }
    throw new Error('In-app purchases are not available on this build. Missing product ID.');
  }
  await initIapConnection();
  await loadPremiumProductDetails().catch(() => null);
  const purchasePromise = waitForPurchase(env.iapProductId);
  try {
    console.log('[iap] requestPurchase start', { sku: env.iapProductId });
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
    console.log('[iap] requestPurchase error', error);
    cancelPendingPurchase(error instanceof Error ? error : String(error));
    throw error;
  }
  const purchase = await purchasePromise;
  console.log('[iap] requestPurchase completed', {
    productId: purchase.productId,
    transactionId: (purchase as any).transactionId,
    purchaseState: (purchase as any).purchaseState,
  });
  await RNIap.finishTransaction({ purchase, isConsumable: false });
  console.log('[iap] finishTransaction complete');
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
      console.log('[iap] falling back to mock restore (dev)');
      return fallbackPurchase();
    }
    throw new Error('In-app purchases are not available on this build. Missing product ID.');
  }
  await initIapConnection();
  await loadPremiumProductDetails().catch(() => null);
  console.log('[iap] getAvailablePurchases start');
  const purchases = await RNIap.getAvailablePurchases({
    alsoPublishToEventListenerIOS: false,
    onlyIncludeActiveItemsIOS: true,
  });
  console.log('[iap] getAvailablePurchases result', purchases?.length ?? 0);
  const premiumPurchase = purchases.find((item) => {
    if (item.productId === env.iapProductId) return true;
    return Array.isArray(item.ids) && item.ids.includes(env.iapProductId);
  });
  if (!premiumPurchase) {
    console.log('[iap] no matching purchase found during restore');
    return null;
  }
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
