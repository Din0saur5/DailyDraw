import { useMutation } from '@tanstack/react-query';

import { invokeEdge } from '@/lib/edge';
import { useSessionStore } from '@/stores/useSessionStore';

type SetUsernameInput = {
  username: string;
};

type SetUsernameResponse = {
  username: string;
};

const setUsername = async (input: SetUsernameInput): Promise<SetUsernameResponse> => {
  return invokeEdge('username-set', {
    body: { username: input.username },
  });
};

export const useSetUsernameMutation = () => {
  const profile = useSessionStore((state) => state.profile);
  const setProfile = useSessionStore((state) => state.setProfile);

  return useMutation({
    mutationFn: setUsername,
    onSuccess: (data) => {
      if (profile) {
        setProfile({ ...profile, username: data.username });
      }
    },
  });
};
