import { useMutation } from '@tanstack/react-query';

import { invokeEdge } from '@/lib/edge';
import { useSessionStore } from '@/stores/useSessionStore';

type PremiumStatusInput = {
  isPremium: boolean;
  productId?: string | null;
  transactionId?: string | null;
  receiptData?: string | null;
};

type PremiumStatusResult = {
  isPremium: boolean;
  productId?: string | null;
  transactionId?: string | null;
  environment?: string | null;
  expiresAt?: string | null;
};

export const updatePremiumStatus = async (payload: PremiumStatusInput): Promise<PremiumStatusResult> => {
  return invokeEdge<PremiumStatusResult>('premium-set', {
    body: payload,
    method: 'POST',
  });
};

export const usePremiumStatusMutation = () => {
  const setProfile = useSessionStore((state) => state.setProfile);
  const profile = useSessionStore((state) => state.profile);

  return useMutation({
    mutationFn: updatePremiumStatus,
    onSuccess: (result) => {
      if (profile) {
        setProfile({
          ...profile,
          isPremium: result.isPremium,
        });
      }
    },
  });
};
