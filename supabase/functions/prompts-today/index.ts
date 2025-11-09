import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handlePromptsToday } from '../_shared/core/prompts.ts';
import { jsonResponse, handleErrorResponse } from '../_shared/runtime/http.ts';
import { createSupabaseClient } from '../_shared/runtime/supabaseClient.ts';
import { createRepositories } from '../_shared/runtime/repositories.ts';
import { requireUser } from '../_shared/runtime/auth.ts';

serve(async (req) => {
  try {
    const supabase = createSupabaseClient(req);
    await requireUser(req, supabase);
    const repos = createRepositories(supabase);
    const result = await handlePromptsToday({ promptsRepo: repos.prompts });
    return jsonResponse(result);
  } catch (error) {
    return handleErrorResponse(error);
  }
});
