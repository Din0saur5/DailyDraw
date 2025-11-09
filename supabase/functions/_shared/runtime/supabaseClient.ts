import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('[edge] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars');
}

export const createSupabaseClient = (req: Request) => {
  return createClient(supabaseUrl ?? '', supabaseServiceKey ?? '', {
    global: {
      headers: {
        Authorization: req.headers.get('Authorization') ?? '',
      },
    },
  });
};
