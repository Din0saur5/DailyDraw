export const config = {
  verifyJWT: false,
};

// App Store Server Notifications (v2) handler
// Verifies the signedPayload JWS, parses the notification, and updates user premium metadata.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { createSupabaseClient } from '../_shared/runtime/supabaseClient.ts';

type Jwk = {
  kty: string;
  kid: string;
  use?: string;
  alg?: string;
  n: string;
  e: string;
};

type NotificationPayload = {
  notificationType?: string;
  subtype?: string;
  notificationUUID?: string;
  data?: {
    appAppleId?: number;
    bundleId?: string;
    environment?: string;
    signedTransactionInfo?: string;
    signedRenewalInfo?: string;
  };
};

type TransactionPayload = {
  originalTransactionId?: string;
  transactionId?: string;
  productId?: string;
  expiresDate?: string;
  expiresDateMs?: string;
  purchaseDate?: string;
  purchaseDateMs?: string;
  appAccountToken?: string;
  autoRenewStatus?: number; // 0 = off, 1 = on
  storefront?: string;
  currency?: string;
  price?: string;
};

const APPLE_JWKS_PROD = 'https://api.storekit.itunes.apple.com/inApps/v1/notifications';
const APPLE_JWKS_SANDBOX = 'https://api.storekit-sandbox.itunes.apple.com/inApps/v1/notifications';

const APPLE_API_KEY_ID = Deno.env.get('APPLE_API_KEY_ID') ?? '';
const APPLE_API_ISSUER_ID = Deno.env.get('APPLE_API_ISSUER_ID') ?? '';
const APPLE_API_PRIVATE_KEY = Deno.env.get('APPLE_API_PRIVATE_KEY') ?? '';

const textResponse = (status: number, message: string) =>
  new Response(JSON.stringify({ ok: status === 200, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const base64UrlToUint8Array = (input: string) => {
  const pad = '='.repeat((4 - (input.length % 4)) % 4);
  const b64 = (input + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
};

const decodeJwsPayload = (jws: string) => {
  const parts = jws.split('.');
  if (parts.length !== 3) return null;
  const payloadJson = new TextDecoder().decode(base64UrlToUint8Array(parts[1]));
  return JSON.parse(payloadJson);
};

const base64UrlEncode = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const pemToPkcs8 = (pem: string) => {
  const cleaned = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const raw = atob(cleaned);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) {
    view[i] = raw.charCodeAt(i);
  }
  return buffer;
};

let cachedDevToken: { token: string; exp: number } | null = null;
const getAppleDeveloperToken = async (): Promise<string | null> => {
  if (!APPLE_API_KEY_ID || !APPLE_API_ISSUER_ID || !APPLE_API_PRIVATE_KEY) {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (cachedDevToken && now < cachedDevToken.exp - 60) {
    return cachedDevToken.token;
  }

  const header = {
    alg: 'ES256',
    kid: APPLE_API_KEY_ID,
    typ: 'JWT',
  };
  const payload = {
    iss: APPLE_API_ISSUER_ID,
    iat: now,
    exp: now + 20 * 60, // 20 minutes
    aud: 'appstoreconnect-v1',
  };

  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  try {
    const keyData = pemToPkcs8(APPLE_API_PRIVATE_KEY);
    const key = await crypto.subtle.importKey(
      'pkcs8',
      keyData,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    );
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      new TextEncoder().encode(signingInput),
    );
    const signatureB64 = base64UrlEncode(signature);
    const token = `${signingInput}.${signatureB64}`;
    cachedDevToken = { token, exp: payload.exp };
    return token;
  } catch (error) {
    console.error('[iap-notify] Failed to build Apple developer token', error);
    return null;
  }
};

const importAppleKey = async (jwk: Jwk) => {
  return crypto.subtle.importKey(
    'jwk',
    {
      ...jwk,
      alg: 'RS256',
      ext: true,
    } as JsonWebKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['verify'],
  );
};

const verifyJws = async (jws: string, jwksUrl: string): Promise<boolean> => {
  const parts = jws.split('.');
  if (parts.length !== 3) return false;

  let jwks: { keys?: Jwk[] } = {};
  let authToken: string | null = null;
  try {
    authToken = await getAppleDeveloperToken();
  } catch (error) {
    console.warn('[iap-notify] Unable to generate Apple developer token', error);
  }

  try {
    const res = await fetch(jwksUrl, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    });
    if (!res.ok) {
      console.error('[iap-notify] Failed to fetch JWKS', {
        jwksUrl,
        status: res.status,
        usedAuthToken: Boolean(authToken),
      });
      return false;
    }
    jwks = await res.json();
  } catch (error) {
    console.error('[iap-notify] Error fetching JWKS', { jwksUrl, error, usedAuthToken: Boolean(authToken) });
    return false;
  }

  const keys = jwks.keys ?? [];
  if (!keys.length) {
    console.error('[iap-notify] JWKS contained no keys', { jwksUrl });
    return false;
  }

  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = base64UrlToUint8Array(parts[2]);

  for (const jwk of keys) {
    try {
      const key = await importAppleKey(jwk);
      const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data);
      if (valid) return true;
    } catch (error) {
      console.warn('[iap-notify] Key verify failed', error);
    }
  }
  return false;
};

const selectStatus = (notificationType?: string, expiresMs?: number) => {
  if (!notificationType) return null;
  if (notificationType === 'EXPIRED') return 'expired';
  if (notificationType === 'DID_REVOKE') return 'revoked';
  if (notificationType === 'DID_FAIL_TO_RENEW') return 'billing_retry';
  if (notificationType === 'GRACE_PERIOD') return 'grace_period';
  if (notificationType === 'REFUND') return 'refunded';
  if (notificationType === 'CONSUMPTION_REQUEST') return 'consumption_requested';
  if (notificationType === 'REFUND_DECLINED') return 'refund_declined';
  if (notificationType === 'PRICE_INCREASE' || notificationType === 'DID_RENEW') {
    return expiresMs && expiresMs > Date.now() ? 'active' : 'expired';
  }
  return 'active';
};

const updateUserForTransaction = async ({
  supabase,
  matchToken,
  matchOriginalTransactionId,
  transaction,
  notificationType,
  environment,
}: {
  supabase: ReturnType<typeof createSupabaseClient>;
  matchToken?: string | null;
  matchOriginalTransactionId?: string | null;
  transaction: TransactionPayload;
  notificationType?: string;
  environment?: string;
}) => {
  const expiresMs = Number(transaction.expiresDateMs ?? transaction.expiresDate ?? NaN);
  const expiresIso = Number.isFinite(expiresMs) ? new Date(expiresMs).toISOString() : null;
  const status = selectStatus(notificationType, Number.isFinite(expiresMs) ? expiresMs : undefined);
  const willRenew = transaction.autoRenewStatus === 1;

  const query = supabase
    .from('users')
    .update({
      apple_product_id: transaction.productId ?? null,
      apple_latest_transaction_id: transaction.transactionId ?? null,
      apple_original_transaction_id: transaction.originalTransactionId ?? matchOriginalTransactionId ?? null,
      apple_app_account_token: matchToken ?? null,
      apple_environment: environment ?? null,
      premium_expires_at: expiresIso,
      subscription_status: status,
      subscription_expires_at: expiresIso,
      will_renew: willRenew,
      is_in_grace_period: status === 'grace_period',
      is_in_billing_retry: status === 'billing_retry',
      revoked_at: status === 'revoked' ? new Date().toISOString() : null,
    })
    .select('id')
    .limit(1);

  if (matchToken) {
    query.eq('apple_app_account_token', matchToken);
  } else if (matchOriginalTransactionId) {
    query.eq('apple_original_transaction_id', matchOriginalTransactionId);
  }

  const { error } = await query;
  if (error) {
    console.error('[iap-notify] Failed to update user', error);
    throw error;
  }
};

serve(async (req) => {
  if (req.method !== 'POST') {
    return textResponse(405, 'Method not allowed');
  }

  let body: { signedPayload?: string };
  try {
    body = await req.json();
  } catch {
    return textResponse(400, 'Invalid JSON body');
  }

  if (!body?.signedPayload || typeof body.signedPayload !== 'string') {
    return textResponse(400, 'signedPayload is required');
  }

  const supabase = createSupabaseClient(req);

  // Verify with prod JWKS first, then sandbox if prod fails.
  const verifiedProd = await verifyJws(body.signedPayload, APPLE_JWKS_PROD);
  const verifiedSandbox = verifiedProd ? false : await verifyJws(body.signedPayload, APPLE_JWKS_SANDBOX);
  if (!verifiedProd && !verifiedSandbox) {
    console.warn('[iap-notify] JWS verification failed', {
      verifiedProd,
      verifiedSandbox,
      jwksProd: APPLE_JWKS_PROD,
      jwksSandbox: APPLE_JWKS_SANDBOX,
    });
    return textResponse(401, 'Invalid signature');
  }

  const outer = decodeJwsPayload(body.signedPayload) as NotificationPayload | null;
  if (!outer) {
    return textResponse(400, 'Unable to parse signedPayload');
  }

  const environment = outer.data?.environment ?? (verifiedSandbox ? 'Sandbox' : 'Production');

  let transaction: TransactionPayload | null = null;
  const signedTransaction = outer.data?.signedTransactionInfo;
  if (signedTransaction) {
    transaction = decodeJwsPayload(signedTransaction) as TransactionPayload | null;
  }

  const originalTransactionId =
    transaction?.originalTransactionId ?? outer.data?.signedRenewalInfo
      ? decodeJwsPayload(outer.data!.signedRenewalInfo!)?.originalTransactionId
      : undefined;
  const appAccountToken = transaction?.appAccountToken;

  console.log('[iap-notify] notification', {
    notificationType: outer.notificationType,
    subtype: outer.subtype,
    environment,
    originalTransactionId,
    transactionId: transaction?.transactionId,
    productId: transaction?.productId,
    appAccountToken,
    expiresDateMs: transaction?.expiresDateMs ?? transaction?.expiresDate,
  });

  if (!transaction) {
    return textResponse(200, 'No transaction payload to process');
  }

  try {
    await updateUserForTransaction({
      supabase,
      matchToken: appAccountToken ?? undefined,
      matchOriginalTransactionId: originalTransactionId ?? undefined,
      transaction,
      notificationType: outer.notificationType,
      environment,
    });
  } catch (error) {
    console.error('[iap-notify] Failed to apply notification', error);
    return textResponse(500, 'Failed to apply notification');
  }

  return textResponse(200, 'ok');
}, { verifyJWT: false });
