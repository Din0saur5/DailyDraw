import { createHttpError } from './errors.ts';

const USERNAME_REGEX = /^[A-Za-z0-9_.]{3,20}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const requireJsonBody = async <T>(req: Request): Promise<T> => {
  try {
    return (await req.json()) as T;
  } catch {
    throw createHttpError(400, 'Invalid JSON body');
  }
};

export const requireQueryParam = (url: URL, key: string) => {
  const value = url.searchParams.get(key);
  if (!value) {
    throw createHttpError(400, `Missing "${key}" query param`);
  }
  return value;
};

export const validateUsername = (raw?: string) => {
  if (!raw) throw createHttpError(400, 'username is required');
  const username = raw.trim();
  if (!USERNAME_REGEX.test(username)) {
    throw createHttpError(422, 'Username must be 3-20 chars (letters, numbers, underscore, dot).');
  }
  return username;
};

export const validateUuid = (value: string, field = 'id') => {
  if (!UUID_REGEX.test(value)) {
    throw createHttpError(422, `${field} must be a valid UUID`);
  }
  return value;
};

export const validateIntId = (value: string | number, field = 'id') => {
  const normalized =
    typeof value === 'number' && Number.isFinite(value) ? value.toString(10) : String(value ?? '');
  if (!/^[0-9]+$/.test(normalized)) {
    throw createHttpError(422, `${field} must be a positive integer string`);
  }
  return normalized;
};

export const validateCaption = (caption?: string) => {
  if (!caption) return null;
  const trimmed = caption.trim();
  if (trimmed.length > 300) {
    throw createHttpError(422, 'Caption must be 300 characters or less');
  }
  return trimmed;
};

export const validateDimensions = (width?: number, height?: number) => {
  if (!width || !height || width <= 0 || height <= 0) {
    throw createHttpError(422, 'Width and height must be positive numbers');
  }
  return { width, height };
};

export const validateReason = (reason?: string) => {
  if (!reason) throw createHttpError(400, 'reason is required');
  const trimmed = reason.trim();
  if (trimmed.length < 3 || trimmed.length > 280) {
    throw createHttpError(422, 'Reason must be between 3 and 280 characters');
  }
  return trimmed;
};
