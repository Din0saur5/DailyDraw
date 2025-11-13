import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import {
  handlePremiumStatus,
  type AppleReceiptResponse,
  type PremiumStatusPayload,
} from '../_shared/core/premium.ts';
import { createHttpError, HttpError } from '../_shared/core/errors.ts';
import { requireJsonBody } from '../_shared/core/validators.ts';
import { requireUser } from '../_shared/runtime/auth.ts';
import { jsonResponse, handleErrorResponse } from '../_shared/runtime/http.ts';
import { createRepositories } from '../_shared/runtime/repositories.ts';
import { createSupabaseClient } from '../_shared/runtime/supabaseClient.ts';

const APPLE_PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';

const sharedSecret = Deno.env.get('APPLE_IAP_SHARED_SECRET');

serve(async (req) => {
  try {
    const supabase = createSupabaseClient(req);
    const user = await requireUser(req, supabase);
    const repositories = createRepositories(supabase);
    const payload = await requireJsonBody<PremiumStatusPayload>(req);
    const result = await handlePremiumStatus(
      {
        usersRepo: repositories.users,
        currentUserId: user.id,
        verifyReceipt: (receiptData) => verifyAppleReceipt(receiptData),
        now: () => new Date(),
      },
      payload,
    );
    return jsonResponse(result);
  } catch (error) {
    return handleErrorResponse(error);
  }
});

const verifyAppleReceipt = async (receiptData: string): Promise<AppleReceiptResponse> => {
  if (!sharedSecret) {
    throw createHttpError(500, 'APPLE_IAP_SHARED_SECRET is not configured.');
  }

  if (typeof receiptData !== 'string') {
    console.error('[iap] receiptData is not a string', {
      type: typeof receiptData,
      value: receiptData,
    });
    throw createHttpError(400, 'Invalid receipt data type received from client.');
  }

  console.log('[iap] receipt length', receiptData.length);

  let response = await postToApple(APPLE_PRODUCTION_URL, receiptData, sharedSecret);
  if (response.status === 21007) {
    response = await postToApple(APPLE_SANDBOX_URL, receiptData, sharedSecret);
  } else if (response.status === 21008) {
    response = await postToApple(APPLE_PRODUCTION_URL, receiptData, sharedSecret);
  }

  console.log('[iap] Apple status', response.status);

  if (response.status !== 0) {
    throw createHttpError(422, describeAppleStatus(response.status));
  }

  return response;
};

const postToApple = async (url: string, receiptData: string, password: string) => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        'receipt-data': receiptData,
        password,
        'exclude-old-transactions': true,
      }),
    });
    if (!response.ok) {
      throw createHttpError(response.status, 'Apple verification request failed');
    }
    const json = (await response.json()) as AppleReceiptResponse;
    console.log('[iap] Apple verify response', url, json.status);
    return json;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw createHttpError(502, 'Unable to reach Apple verification service', error);
  }
};

const describeAppleStatus = (status: number) => {
  switch (status) {
    case 21000:
      return 'Apple could not process this receipt request.';
    case 21002:
      return 'Apple rejected the receipt payload as malformed.';
    case 21003:
      return 'Apple could not authenticate this receipt.';
    case 21004:
      return 'The shared secret is invalid.';
    case 21005:
      return 'Receipt is temporarily unavailable. Try again shortly.';
    case 21006:
      return 'This subscription has expired.';
    case 21007:
      return 'Sandbox receipt sent to production environment.';
    case 21008:
      return 'Production receipt sent to sandbox environment.';
    default:
      return `Apple returned status ${status}.`;
  }
};
