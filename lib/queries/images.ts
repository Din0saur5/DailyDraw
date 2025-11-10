import { useQuery } from '@tanstack/react-query';

import { invokeEdge } from '@/lib/edge';

export type SignedImageResponse = {
  url: string;
  expiresAt: string;
};

async function fetchSignedImage(key: string): Promise<SignedImageResponse> {
  return invokeEdge<SignedImageResponse>('images-sign-get', {
    method: 'GET',
    query: { key },
  });
}

export function useSignedImageUrl(key?: string | null, enabled = true) {
  return useQuery({
    queryKey: ['image-sign', key],
    enabled: Boolean(key) && enabled,
    queryFn: () => fetchSignedImage(key as string),
    staleTime: 1000 * 60 * 4,
    gcTime: 1000 * 60 * 10,
  });
}

export const imageQueries = {
  fetchSignedImage,
};
