import { PropsWithChildren } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { env } from '@/lib/env';
import { useSessionStore } from '@/stores/useSessionStore';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { palette } from '@/constants/palette';

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
        <Image source={require('@/assets/images/dailydrawlogo.png')} style={styles.loadingLogo} />
        <ActivityIndicator color={palette.black} />
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
    backgroundColor: palette.canvas,
  },
  helper: {
    textAlign: 'center',
    color: palette.black,
  },
  loadingLogo: {
    height: 72,
    width: 160,
    resizeMode: 'contain',
  },
});
