import { R2Signer } from './r2.ts';
import { SubmissionsRepository } from './repos.ts';
import { createHttpError } from './errors.ts';

export interface ImageSignDeps {
  submissionsRepo: SubmissionsRepository;
  signer: R2Signer;
  currentUserId: string;
}

export const handleImageSignGet = async (deps: ImageSignDeps, key: string) => {
  if (!key) {
    throw createHttpError(400, 'key is required');
  }

  const submission = await deps.submissionsRepo.findByStorageKey(key);
  if (!submission) {
    throw createHttpError(404, 'Submission not found for key');
  }

  const isOwner = submission.user_id === deps.currentUserId;
  if (!isOwner && submission.is_removed) {
    throw createHttpError(403, 'Submission not available');
  }

  const signed = await deps.signer.signGetObject(key, 300);
  return { url: signed.url, expiresAt: signed.expiresAt };
};
