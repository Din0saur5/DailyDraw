import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleImageSignGet } from '../_shared/core/images.ts';
import { requireQueryParam } from '../_shared/core/validators.ts';
import { jsonResponse, handleErrorResponse } from '../_shared/runtime/http.ts';
import { createSupabaseClient } from '../_shared/runtime/supabaseClient.ts';
import { createRepositories } from '../_shared/runtime/repositories.ts';
import { requireUser } from '../_shared/runtime/auth.ts';
import { createR2Signer } from '../_shared/runtime/r2.ts';

const signer = createR2Signer();

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const supabase = createSupabaseClient(req);
    const user = await requireUser(req, supabase);
    const repos = createRepositories(supabase);
    const key = requireQueryParam(url, 'key');
    const result = await handleImageSignGet(
      { submissionsRepo: repos.submissions, signer, currentUserId: user.id },
      key,
    );
    return jsonResponse(result);
  } catch (error) {
    return handleErrorResponse(error);
  }
});
