import { useInfiniteQuery } from '@tanstack/react-query';

import { invokeEdge } from '@/lib/edge';
import {
  SubmissionWithUser,
  SubmissionWithUserResponse,
  normalizeSubmissionWithUser,
} from '@/types/submission';

const FEED_PAGE_SIZE = 20;

type FetchFeedParams = {
  dailyPromptId: string;
  cursor?: string;
};

async function fetchFeedPage({ dailyPromptId, cursor }: FetchFeedParams) {
  const response = await invokeEdge<SubmissionWithUserResponse[]>('feed', {
    method: 'GET',
    query: {
      dailyPromptId,
      limit: FEED_PAGE_SIZE,
      cursor, // undefined values are stripped inside invokeEdge
    },
  });

  return (response ?? []).map(normalizeSubmissionWithUser);
}

export function useFeedQuery(dailyPromptId?: string | null) {
  return useInfiniteQuery<SubmissionWithUser[]>({
    queryKey: ['feed', dailyPromptId],
    enabled: Boolean(dailyPromptId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      fetchFeedPage({ dailyPromptId: dailyPromptId as string, cursor: pageParam }),
    getNextPageParam: (lastPage) =>
      lastPage.length === FEED_PAGE_SIZE
        ? lastPage[lastPage.length - 1]?.createdAt
        : undefined,
  });
}

export const feedQueries = {
  fetchFeedPage,
  pageSize: FEED_PAGE_SIZE,
};
