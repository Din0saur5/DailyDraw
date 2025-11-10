import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { Submission, SubmissionResponse, normalizeSubmission } from '@/types/submission';

export const submissionQueryKeys = {
  byPrompt: (userId: string, promptId: string) => ['submission', userId, promptId] as const,
};

export async function fetchSubmissionForPrompt(
  userId: string,
  dailyPromptId: string,
): Promise<Submission | null> {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase
    .from('submissions')
    .select(
      'id,daily_prompt_id,user_id,caption,original_key,mime_type,width,height,is_removed,created_at',
    )
    .eq('user_id', userId)
    .eq('daily_prompt_id', dailyPromptId)
    .maybeSingle<SubmissionResponse>();

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message ?? 'Failed to load submission.');
  }

  return data ? normalizeSubmission(data) : null;
}

export function useSubmissionForPrompt(promptId?: string | null, userId?: string | null) {
  const enabled = Boolean(promptId && userId);
  const queryKey = submissionQueryKeys.byPrompt(userId ?? 'unknown', promptId ?? 'unknown');
  return useQuery({
    queryKey,
    enabled,
    queryFn: () => fetchSubmissionForPrompt(userId as string, promptId as string),
  });
}
