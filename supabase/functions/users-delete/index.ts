import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { handleDeleteAccount } from '../_shared/core/users.ts';
import { jsonResponse, handleErrorResponse } from '../_shared/runtime/http.ts';
import { createSupabaseClient } from '../_shared/runtime/supabaseClient.ts';
import { createRepositories } from '../_shared/runtime/repositories.ts';
import { requireUser } from '../_shared/runtime/auth.ts';

const METHOD_NOT_ALLOWED_RESPONSE = jsonResponse(
  { error: 'Method Not Allowed' },
  { status: 405, headers: { Allow: 'DELETE' } },
);

serve(async (req) => {
  try {
    if (req.method !== 'DELETE') {
      return METHOD_NOT_ALLOWED_RESPONSE;
    }

    const supabase = createSupabaseClient(req);
    const user = await requireUser(req, supabase);
    const repos = createRepositories(supabase);

    await handleDeleteAccount({ usersRepo: repos.users, currentUserId: user.id });

    return jsonResponse({ ok: true });
  } catch (error) {
    return handleErrorResponse(error);
  }
});
