import { PropsWithChildren, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/useSessionStore';

export function SessionProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const setStatus = useSessionStore((state) => state.setStatus);
  const setSession = useSessionStore((state) => state.setSession);
  const setProfile = useSessionStore((state) => state.setProfile);
  const devBypass = useSessionStore((state) => state.devBypass);

  useEffect(() => {
    if (devBypass) {
      setStatus('authenticated');
      return;
    }

    if (!supabase) {
      setSession(null);
      setProfile(null);
      setStatus('unauthenticated');
      return;
    }

    let isMounted = true;

    const loadProfile = async (userId: string) => {
      const { data, error } = await supabase
        .from('user_public')
        .select('id,username,is_premium')
        .eq('id', userId)
        .maybeSingle();

      if (!isMounted || error || !data) {
        if (error) {
          console.warn('[session] Failed to load profile', error.message);
        }
        return;
      }

      setProfile({
        id: data.id,
        username: data.username,
        isPremium: data.is_premium,
      });
    };

    const clearSession = () => {
      setSession(null);
      setProfile(null);
      setStatus('unauthenticated');
    };

    const bootstrap = async () => {
      setStatus('loading');
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (error || !data.session) {
        clearSession();
        return;
      }

      setSession(data.session);
      await loadProfile(data.session.user.id);
      if (isMounted) {
        setStatus('authenticated');
      }
    };

    bootstrap();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'PASSWORD_RECOVERY') {
        if (session) {
          setSession(session);
        }
        router.replace('/reset-password');
        return;
      }

      if (!session) {
        clearSession();
        return;
      }

      setSession(session);
      await loadProfile(session.user.id);
      if (isMounted) {
        setStatus('authenticated');
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription?.unsubscribe();
    };
  }, [devBypass, router, setProfile, setSession, setStatus]);

  return children;
}
