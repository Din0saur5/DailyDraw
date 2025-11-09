import { SubmissionsRepository } from './repos.ts';
import { createHttpError } from './errors.ts';
import { validateCaption, validateDimensions, validateUuid } from './validators.ts';

export interface SubmissionPayload {
  dailyPromptId?: string;
  key?: string;
  caption?: string;
  width?: number;
  height?: number;
  mime?: string | null;
}

export interface SubmissionDeps {
  submissionsRepo: SubmissionsRepository;
  currentUserId: string;
}

export const handleSubmissionUpsert = async (deps: SubmissionDeps, payload: SubmissionPayload) => {
  if (!payload.dailyPromptId) {
    throw createHttpError(400, 'dailyPromptId is required');
  }
  validateUuid(payload.dailyPromptId, 'dailyPromptId');

  if (!payload.key) {
    throw createHttpError(400, 'key is required');
  }

  const caption = validateCaption(payload.caption);
  const { width, height } = validateDimensions(payload.width, payload.height);

  const result = await deps.submissionsRepo.upsertSubmission({
    dailyPromptId: payload.dailyPromptId,
    key: payload.key,
    caption,
    width,
    height,
    mime: payload.mime ?? null,
    userId: deps.currentUserId,
  });

  return result;
};
