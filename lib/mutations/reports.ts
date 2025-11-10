import { useMutation, UseMutationOptions } from '@tanstack/react-query';

import { invokeEdge } from '@/lib/edge';

export type ReportSubmissionInput = {
  submissionId: string;
  reason: string;
};

export async function submitReport(input: ReportSubmissionInput): Promise<void> {
  await invokeEdge('reports', {
    body: {
      submissionId: input.submissionId,
      reason: input.reason,
    },
  });
}

export function useReportSubmissionMutation(
  options?: UseMutationOptions<void, Error, ReportSubmissionInput>,
) {
  return useMutation({
    mutationFn: submitReport,
    ...options,
  });
}
