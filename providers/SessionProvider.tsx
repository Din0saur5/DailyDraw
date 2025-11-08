import { PropsWithChildren, useEffect } from 'react';
import { env } from '@/lib/env';
import { useSessionStore } from '@/stores/useSessionStore';

export function SessionProvider({ children }: PropsWithChildren) {
  const setStatus = useSessionStore((state) => state.setStatus);

  useEffect(() => {
    // TODO: replace with Supabase session listener.
    if (env.allowDevAuthBypass) {
      setStatus('authenticated');
    } else {
      setStatus('unauthenticated');
    }
  }, [setStatus]);

  return children;
}
