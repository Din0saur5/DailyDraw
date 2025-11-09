import { useQuery } from '@tanstack/react-query';

import { invokeEdge } from '@/lib/edge';
import { DailyPrompt, DailyPromptResponse, normalizeDailyPrompt } from '@/types/prompt';

const promptsQueryKeys = {
  today: ['prompts', 'today'] as const,
};

async function fetchTodayPrompts(): Promise<DailyPrompt[]> {
  const data = await invokeEdge<DailyPromptResponse[]>('prompts-today');
  return (data ?? []).map(normalizeDailyPrompt);
}

export function useTodayPrompts() {
  return useQuery({
    queryKey: promptsQueryKeys.today,
    queryFn: fetchTodayPrompts,
  });
}

export const promptsQueries = {
  keys: promptsQueryKeys,
  fetchTodayPrompts,
};
