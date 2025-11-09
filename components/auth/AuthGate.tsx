import { PropsWithChildren } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { env } from '@/lib/env';
import { useSessionStore } from '@/stores/useSessionStore';
import { AuthScreen } from '@/components/auth/AuthScreen';

export function AuthGate({ children }: PropsWithChildren) {
  const status = useSessionStore((state) => state.status);
  const setStatus = useSessionStore((state) => state.setStatus);
  const setDevBypass = useSessionStore((state) => state.setDevBypass);
  const pathname = usePathname();
  const publicPrefixes = ['/reset-password', '/auth/confirm'];
  const allowPublicRoute = publicPrefixes.some((prefix) => pathname?.startsWith(prefix));

  if (allowPublicRoute) {
    return children;
  }

  if (status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.helper}>Preparing session…</Text>
      </View>
    );
  }

  if (status !== 'authenticated' && !allowPublicRoute) {
    return (
      <AuthScreen
        allowDevBypass={env.allowDevAuthBypass}
        onDevBypass={() => {
          setDevBypass(true);
          setStatus('authenticated');
        }}
      />
    );
  }

  return children;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  helper: {
    textAlign: 'center',
    color: '#555',
  },
});
