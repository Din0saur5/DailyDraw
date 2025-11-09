import { createHttpError } from '../core/errors.ts';

const extractToken = (req: Request) => {
  const header = req.headers.get('Authorization');
  if (!header) {
    throw createHttpError(401, 'Missing Authorization header');
  }

  const [, token] = header.split('Bearer ');
  if (!token) {
    throw createHttpError(401, 'Invalid Authorization header');
  }
  return token.trim();
};

export const requireUser = async (req: Request, supabase: any) => {
  const token = extractToken(req);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw createHttpError(401, 'Unauthorized');
  }
  return data.user;
};
