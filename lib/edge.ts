import { supabase } from '@/lib/supabase';

export type EdgeFunctionName =
  | 'username-set'
  | 'uploads-sign'
  | 'submissions-create'
  | 'images-sign-get'
  | 'prompts-today'
  | 'feed'
  | 'reports';

type EdgeInvokeOptions = {
  body?: Record<string, unknown> | null;
};

export async function invokeEdge<TResponse>(
  name: EdgeFunctionName,
  options: EdgeInvokeOptions = {},
): Promise<TResponse> {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase.functions.invoke<TResponse>(name, {
    body: options.body ?? undefined,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as TResponse;
}
