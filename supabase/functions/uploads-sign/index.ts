import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleUploadSign } from '../_shared/core/uploads.ts';
import { requireJsonBody } from '../_shared/core/validators.ts';
import { jsonResponse, handleErrorResponse } from '../_shared/runtime/http.ts';
import { requireUser } from '../_shared/runtime/auth.ts';
import { createSupabaseClient } from '../_shared/runtime/supabaseClient.ts';
import { createR2Signer } from '../_shared/runtime/r2.ts';

const signer = createR2Signer();

serve(async (req) => {
  try {
    const supabase = createSupabaseClient(req);
    const user = await requireUser(req, supabase);
    const body = await requireJsonBody(req);
    const result = await handleUploadSign({ signer, currentUserId: user.id }, body);
    return jsonResponse(result);
  } catch (error) {
    return handleErrorResponse(error);
  }
});
