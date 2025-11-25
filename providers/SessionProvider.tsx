import { PropsWithChildren, useEffect } from 'react';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { fetchUserProfile } from '@/lib/profile';
import { useSessionStore } from '@/stores/useSessionStore';

const SESSION_BOOTSTRAP_TIMEOUT_MS = 4000;

const parseSessionParams = (url: string) => {
  try {
    const parsed = new URL(url);
    const searchParams = parsed.searchParams;
    const hashParams = new URLSearchParams(parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash);

    const code = searchParams.get('code') ?? hashParams.get('code');
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');

    return { code, accessToken, refreshToken };
  } catch {
    return { code: null, accessToken: null, refreshToken: null };
  }
};

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

    const client = supabase;

    if (!client) {
      setSession(null);
      setProfile(null);
      setStatus('unauthenticated');
      return;
    }

    let isMounted = true;
    let bootstrapTimer: ReturnType<typeof setTimeout> | null = null;

    const clearBootstrapTimer = () => {
      if (bootstrapTimer) {
        clearTimeout(bootstrapTimer);
        bootstrapTimer = null;
      }
    };

    const loadProfile = async (userId: string) => {
      try {
        const profile = await fetchUserProfile(userId);
        if (!isMounted || !profile) return;
        setProfile(profile);
      } catch (error) {
        console.warn('[session] Failed to load profile', error);
      }
    };

    const clearSession = () => {
      if (!isMounted) return;
      clearBootstrapTimer();
      setSession(null);
      setProfile(null);
      setStatus('unauthenticated');
    };

    const startBootstrapTimer = () => {
      clearBootstrapTimer();
      bootstrapTimer = setTimeout(() => {
        if (!isMounted) return;
        if (useSessionStore.getState().status !== 'loading') return;
        console.warn('[session] Session bootstrap timed out; defaulting to unauthenticated.');
        clearSession();
      }, SESSION_BOOTSTRAP_TIMEOUT_MS);
    };

    const handleSessionFromUrl = async (url: string | null) => {
      if (!url) return;
      const { code, accessToken, refreshToken } = parseSessionParams(url);
      try {
        if (code) {
          await client.auth.exchangeCodeForSession(code);
          return;
        }
        if (accessToken && refreshToken) {
          await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        }
      } catch (error) {
        console.warn('[session] Failed to exchange session from URL', error);
      }
    };

    const bootstrap = async () => {
      setStatus('loading');
      startBootstrapTimer();
      try {
        const initialUrl = await Linking.getInitialURL();
        await handleSessionFromUrl(initialUrl);

        const { data, error } = await client.auth.getSession();
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
      } catch (error) {
        console.warn('[session] Failed to bootstrap session', error);
        if (isMounted) {
          clearSession();
        }
      } finally {
        clearBootstrapTimer();
      }
    };

    bootstrap();

    const urlSubscription = Linking.addEventListener('url', async (event) => {
      await handleSessionFromUrl(event.url);
    });

    const { data: subscription } = client.auth.onAuthStateChange(async (event, session) => {
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
        clearBootstrapTimer();
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription?.unsubscribe();
      urlSubscription.remove();
      clearBootstrapTimer();
    };
  }, [devBypass, router, setProfile, setSession, setStatus]);

  return children;
}
