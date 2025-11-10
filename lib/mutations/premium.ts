import { useMutation } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/useSessionStore';

type PremiumStatusInput = {
  isPremium: boolean;
  productId?: string | null;
  transactionId?: string | null;
  environment?: string | null;
  expiresAt?: string | null;
};

type PremiumStatusResult = {
  id: string;
  username: string;
  isPremium: boolean;
};

export const updatePremiumStatus = async ({
  isPremium,
  productId,
  transactionId,
  environment,
  expiresAt,
}: PremiumStatusInput): Promise<PremiumStatusResult> => {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error(userError?.message ?? 'Missing authenticated user.');
  }

  const { error } = await supabase
    .from('users')
    .update({
      is_premium: isPremium,
      apple_product_id: productId ?? null,
      apple_latest_transaction_id: transactionId ?? null,
      apple_environment: environment ?? null,
      premium_expires_at: expiresAt ?? null,
    })
    .eq('id', user.id);

  if (error) {
    throw new Error(error.message ?? 'Unable to update premium status.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_public')
    .select('id,username,is_premium')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    throw new Error(profileError?.message ?? 'Failed to load updated profile.');
  }

  return {
    id: profile.id,
    username: profile.username,
    isPremium: profile.is_premium,
  };
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
          id: result.id,
          username: result.username,
          isPremium: result.isPremium,
        });
      }
    },
  });
};
