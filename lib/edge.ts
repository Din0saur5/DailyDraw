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
  query?: Record<string, string | number | boolean | null | undefined>;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
};

export async function invokeEdge<TResponse>(
  name: EdgeFunctionName,
  options: EdgeInvokeOptions = {},
): Promise<TResponse> {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const targetName = buildTargetName(name, options.query);

  const { data, error } = await supabase.functions.invoke<TResponse>(targetName, {
    body: options.body ?? undefined,
    method: options.method,
  });

  if (error) {
    throw new Error(await formatEdgeError(error));
  }

  return data as TResponse;
}

const buildTargetName = (
  base: EdgeFunctionName,
  query?: Record<string, string | number | boolean | null | undefined>,
) => {
  if (!query) return base;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    params.append(key, String(value));
  });
  const search = params.toString();
  return search ? `${base}?${search}` : base;
};

async function formatEdgeError(error: any): Promise<string> {
  const defaultMessage = typeof error?.message === 'string' ? error.message : 'Request failed';
  const context = error?.context ?? error?.response;

  if (!context) {
    return defaultMessage;
  }

  // FunctionsHttpError passes the fetch Response as the context.
  if (typeof context === 'object' && typeof (context as Response).text === 'function') {
    try {
      const response = context as Response;
      const clone = response.clone ? response.clone() : response;
      const text = await clone.text();
      if (!text) return defaultMessage;
      try {
        const parsed = JSON.parse(text);
        if (parsed?.error) {
          if (typeof parsed.error === 'string') {
            return parsed.error;
          }
          if (typeof parsed.error?.message === 'string') {
            return parsed.error.message;
          }
        }
        if (typeof parsed?.message === 'string') {
          return parsed.message;
        }
        return text;
      } catch {
        return text;
      }
    } catch {
      return defaultMessage;
    }
  }

  if (typeof context?.message === 'string') {
    return context.message;
  }

  return defaultMessage;
}
