import { PropsWithChildren } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';
import { env } from '@/lib/env';
import { useSessionStore } from '@/stores/useSessionStore';

export function AuthGate({ children }: PropsWithChildren) {
  const status = useSessionStore((state) => state.status);
  const setStatus = useSessionStore((state) => state.setStatus);

  if (status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.helper}>Preparing session…</Text>
      </View>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Sign in to DailyDraw</Text>
        <Text style={styles.helper}>
          Password-based login + Supabase magic links land here in a future PR. For now we gate the
          rest of the app until auth wiring is ready.
        </Text>
        {env.allowDevAuthBypass && (
          <Button title="Bypass auth (dev only)" onPress={() => setStatus('authenticated')} />
        )}
      </View>
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
  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  helper: {
    textAlign: 'center',
    color: '#555',
  },
});
