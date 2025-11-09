import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleSetUsername } from '../_shared/core/username.ts';
import { requireJsonBody } from '../_shared/core/validators.ts';
import { jsonResponse, handleErrorResponse } from '../_shared/runtime/http.ts';
import { createSupabaseClient } from '../_shared/runtime/supabaseClient.ts';
import { createRepositories } from '../_shared/runtime/repositories.ts';
import { requireUser } from '../_shared/runtime/auth.ts';

serve(async (req) => {
  try {
    const supabase = createSupabaseClient(req);
    const user = await requireUser(req, supabase);
    const repos = createRepositories(supabase);
    const body = await requireJsonBody(req);
    const result = await handleSetUsername(
      { usersRepo: repos.users, currentUserId: user.id },
      body,
    );
    return jsonResponse(result);
  } catch (error) {
    return handleErrorResponse(error);
  }
});
