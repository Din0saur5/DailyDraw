import { R2Signer } from './r2.ts';
import { formatDateKey } from './time.ts';
import { createHttpError } from './errors.ts';

const MAX_BYTES = 10 * 1024 * 1024;
const EXT_MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

export interface UploadSignDeps {
  signer: R2Signer;
  currentUserId: string;
  now?: () => Date;
  uuid?: () => string;
}

export interface UploadSignPayload {
  ext?: string;
  size?: number;
  promptDate?: string;
}

export const handleUploadSign = async (deps: UploadSignDeps, payload: UploadSignPayload) => {
  const ext = (payload.ext ?? '').toLowerCase();
  if (!EXT_MIME_MAP[ext]) {
    throw createHttpError(422, 'ext must be jpg or png');
  }

  if (!payload.size || payload.size <= 0) {
    throw createHttpError(422, 'size must be a positive number');
  }

  if (payload.size > MAX_BYTES) {
    throw createHttpError(413, 'File size exceeds 10MB limit');
  }

  const now = deps.now ? deps.now() : new Date();
  const promptDate = payload.promptDate ?? formatDateKey(now);
  const uuid = deps.uuid ? deps.uuid() : crypto.randomUUID();
  const key = `orig/${deps.currentUserId}/${promptDate}/${uuid}.${ext}`;
  const mime = EXT_MIME_MAP[ext];

  const signed = await deps.signer.signPutObject(key, mime, 300);
  return { key, mime, putUrl: signed.url, expiresAt: signed.expiresAt };
};
