import { useMutation } from '@tanstack/react-query';

import { invokeEdge } from '@/lib/edge';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/useSessionStore';

type DeleteAccountResponse = {
  ok: true;
};

const deleteAccount = async (): Promise<DeleteAccountResponse> => {
  return invokeEdge('users-delete', {
    method: 'DELETE',
  });
};

export const useDeleteAccountMutation = () => {
  const resetSession = useSessionStore((state) => state.reset);

  return useMutation({
    mutationFn: deleteAccount,
    onSuccess: async () => {
      try {
        await supabase?.auth.signOut();
      } catch {
        // Ignore sign-out errors; the session will be cleared locally below.
      }
      resetSession();
    },
  });
};
