import { HttpError } from '../core/errors.ts';

export const jsonResponse = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    status: init.status ?? 200,
  });

export const handleErrorResponse = (error: unknown) => {
  if (error instanceof HttpError) {
    return jsonResponse(
      { error: error.message, details: error.details ?? null },
      { status: error.status },
    );
  }

  console.error('[edge] unexpected error', error);
  return jsonResponse({ error: 'Internal Server Error' }, { status: 500 });
};
