import { SubmissionsRepository, SubmissionWithUser } from './repos.ts';
import { createHttpError } from './errors.ts';
import { validateUuid } from './validators.ts';

export interface FeedDeps {
  submissionsRepo: SubmissionsRepository;
}

export const handleFeedRequest = async (
  deps: FeedDeps,
  params: { dailyPromptId?: string },
): Promise<SubmissionWithUser[]> => {
  if (!params.dailyPromptId) {
    throw createHttpError(400, 'dailyPromptId is required');
  }
  validateUuid(params.dailyPromptId, 'dailyPromptId');

  return deps.submissionsRepo.listFeed({ dailyPromptId: params.dailyPromptId, limit: 50 });
};
