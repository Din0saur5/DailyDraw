import { useMutation, UseMutationOptions } from '@tanstack/react-query';

import { invokeEdge } from '@/lib/edge';
import { Submission, SubmissionResponse, normalizeSubmission } from '@/types/submission';

export type CreateSubmissionInput = {
  dailyPromptId: string;
  key: string;
  caption: string | null;
  width: number;
  height: number;
  mime: string | null;
};

export async function createSubmission(input: CreateSubmissionInput): Promise<Submission> {
  const response = await invokeEdge<SubmissionResponse>('submissions-create', {
    body: {
      dailyPromptId: input.dailyPromptId,
      key: input.key,
      caption: input.caption,
      width: input.width,
      height: input.height,
      mime: input.mime,
    },
  });
  return normalizeSubmission(response);
}

export function useCreateSubmissionMutation(
  options?: UseMutationOptions<Submission, Error, CreateSubmissionInput>,
) {
  return useMutation({
    mutationFn: createSubmission,
    ...options,
  });
}
