import { createHttpError } from './errors.ts';
import type { UsersRepository } from './repos.ts';

export interface PremiumStatusPayload {
  isPremium?: boolean;
  receiptData?: string | null;
  productId?: string | null;
  transactionId?: string | null;
}

export interface AppleReceiptInfo {
  product_id?: string;
  transaction_id?: string;
  original_transaction_id?: string;
  expires_date?: string;
  expires_date_ms?: string;
  purchase_date_ms?: string;
}

export interface AppleReceiptResponse {
  status: number;
  environment?: string;
  latest_receipt_info?: AppleReceiptInfo[];
  receipt?: {
    in_app?: AppleReceiptInfo[];
  };
}

interface PremiumHandlerDeps {
  usersRepo: UsersRepository;
  currentUserId: string;
  verifyReceipt: (receiptData: string) => Promise<AppleReceiptResponse>;
  now: () => Date;
}

const buildResetPayload = (userId: string) => ({
  userId,
  appleProductId: null,
  appleLatestTransactionId: null,
  appleOriginalTransactionId: null,
  appleAppAccountToken: null,
  appleEnvironment: null,
  premiumExpiresAt: null,
  subscriptionStatus: null,
  subscriptionExpiresAt: null,
  willRenew: null,
  isInGracePeriod: null,
  isInBillingRetry: null,
  revokedAt: null,
  revocationReason: null,
  lastAppleNotificationAt: null,
  lastAppleNotificationType: null,
});

export const handlePremiumStatus = async (
  deps: PremiumHandlerDeps,
  body: PremiumStatusPayload,
) => {
  const isPremium = Boolean(body?.isPremium);
  if (!isPremium) {
    await deps.usersRepo.updatePremiumMetadata(buildResetPayload(deps.currentUserId));
    return { isPremium: false };
  }

  const receiptData = body?.receiptData?.trim();
  if (!receiptData) {
    throw createHttpError(400, 'receiptData is required');
  }

  const productId = body?.productId?.trim();
  if (!productId) {
    throw createHttpError(400, 'productId is required');
  }

  const response = await deps.verifyReceipt(receiptData);
  const receipt = selectLatestReceipt(response, productId);
  if (!receipt) {
    throw createHttpError(422, 'Apple did not return an active subscription for this product.');
  }

  const expiresAt = resolveExpiration(receipt);
  console.log('[iap] receipt chosen for premium-set', {
    productId: receipt.product_id,
    transactionId: receipt.transaction_id,
    originalTransactionId: receipt.original_transaction_id,
    expiresDateMs: receipt.expires_date_ms,
    expiresDate: receipt.expires_date,
    now: deps.now().toISOString(),
    environment: response.environment,
  });
  if (!expiresAt) {
    throw createHttpError(422, 'Apple receipt is missing an expiration date.');
  }

  if (expiresAt.getTime() <= deps.now().getTime()) {
    throw createHttpError(402, 'Subscription has expired. Renew via Apple and try again.');
  }

  const originalTransactionId =
    receipt.original_transaction_id ?? body.transactionId ?? receipt.transaction_id ?? null;
  const latestTransactionId = receipt.transaction_id ?? originalTransactionId;
  const expiresAtIso = expiresAt.toISOString();

  await deps.usersRepo.updatePremiumMetadata({
    userId: deps.currentUserId,
    appleProductId: productId,
    appleLatestTransactionId: latestTransactionId,
    appleOriginalTransactionId: originalTransactionId,
    appleEnvironment: response.environment ?? null,
    premiumExpiresAt: expiresAtIso,
    subscriptionStatus: 'active',
    subscriptionExpiresAt: expiresAtIso,
    willRenew: true,
    isInGracePeriod: false,
    isInBillingRetry: false,
    revokedAt: null,
    revocationReason: null,
    lastAppleNotificationAt: null,
    lastAppleNotificationType: null,
  });

  return {
    isPremium: true,
    productId,
    transactionId: latestTransactionId,
    environment: response.environment ?? null,
    expiresAt: expiresAtIso,
  };
};

const selectLatestReceipt = (response: AppleReceiptResponse, productId: string) => {
  const pool = [
    ...(response.latest_receipt_info ?? []),
    ...(response.receipt?.in_app ?? []),
  ];
  const matches = pool.filter((entry) => entry.product_id === productId);
  if (!matches.length) return null;
  return matches.reduce((latest, entry) => {
    const latestTime = extractComparisonTimestamp(latest);
    const entryTime = extractComparisonTimestamp(entry);
    return entryTime > latestTime ? entry : latest;
  });
};

const extractComparisonTimestamp = (entry: AppleReceiptInfo) => {
  const expires = Number(entry.expires_date_ms ?? entry.purchase_date_ms ?? 0);
  return Number.isFinite(expires) ? expires : 0;
};

const resolveExpiration = (entry: AppleReceiptInfo) => {
  if (entry.expires_date_ms) {
    const ms = Number(entry.expires_date_ms);
    if (!Number.isNaN(ms) && ms > 0) {
      return new Date(ms);
    }
  }
  if (entry.expires_date) {
    const parsed = new Date(entry.expires_date);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
};
