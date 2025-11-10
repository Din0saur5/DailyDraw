import { useInfiniteQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { LibraryEntry, normalizeLibraryRow } from '@/types/library';

const LIBRARY_PAGE_SIZE = 10;

type FetchLibraryParams = {
  userId: string;
  page: number;
};

const fetchLibraryPage = async ({ userId, page }: FetchLibraryParams): Promise<LibraryEntry[]> => {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const from = page * LIBRARY_PAGE_SIZE;
  const to = from + LIBRARY_PAGE_SIZE - 1;

  const { data, error } = await supabase
    .from('submissions')
    .select(
      'id,daily_prompt_id,user_id,caption,original_key,mime_type,width,height,is_removed,created_at,daily_prompt:daily_prompts(id,prompt_text,prompt_date,difficulty)',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(error.message ?? 'Unable to load library.');
  }

  return (data ?? []).map(normalizeLibraryRow);
};

export const useLibraryQuery = (userId?: string | null) => {
  const enabled = Boolean(userId);
  return useInfiniteQuery({
    queryKey: ['library', userId],
    enabled,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchLibraryPage({ userId: userId as string, page: pageParam as number }),
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === LIBRARY_PAGE_SIZE ? pages.length : undefined,
  });
};

export const libraryQueries = {
  fetchLibraryPage,
  pageSize: LIBRARY_PAGE_SIZE,
};
