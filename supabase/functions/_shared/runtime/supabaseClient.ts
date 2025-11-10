import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn('[edge] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
}

export const createSupabaseClient = (req: Request) => {
  return createClient(supabaseUrl ?? '', supabaseServiceRoleKey ?? '', {
    global: {
      headers: {
        Authorization: req.headers.get('Authorization') ?? '',
      },
    },
  });
};
