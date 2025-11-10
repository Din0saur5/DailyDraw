import { SubmissionsRepository, SubmissionWithUser } from './repos.ts';
import { createHttpError } from './errors.ts';
import { validateUuid } from './validators.ts';

export interface FeedDeps {
  submissionsRepo: SubmissionsRepository;
}

export const handleFeedRequest = async (
  deps: FeedDeps,
  params: { dailyPromptId?: string; limit?: string | number | null; cursor?: string | null },
): Promise<SubmissionWithUser[]> => {
  if (!params.dailyPromptId) {
    throw createHttpError(400, 'dailyPromptId is required');
  }
  validateUuid(params.dailyPromptId, 'dailyPromptId');

  return deps.submissionsRepo.listFeed({
    dailyPromptId: params.dailyPromptId,
    limit: normalizeLimit(params.limit),
    cursor: normalizeCursor(params.cursor),
  });
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const normalizeLimit = (raw?: string | number | null) => {
  if (raw === undefined || raw === null) return DEFAULT_LIMIT;
  const parsed = typeof raw === 'number' ? raw : Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw createHttpError(422, 'limit must be a positive integer');
  }
  return Math.min(parsed, MAX_LIMIT);
};

const normalizeCursor = (raw?: string | null) => {
  if (!raw) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw createHttpError(422, 'cursor must be an ISO-8601 timestamp');
  }
  return date.toISOString();
};
