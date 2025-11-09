import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function ConfirmAccountScreen() {
  const router = useRouter();

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace('/');
    }, 2500);
    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Account confirmed</Text>
        <Text style={styles.helper}>
          You can close this screen. We&apos;re sending you back to the sign-in flow automatically.
        </Text>
        <Pressable style={styles.button} onPress={() => router.replace('/')}>
          <Text style={styles.buttonLabel}>Return to sign in</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  helper: {
    color: '#4b5563',
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: '#111827',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  buttonLabel: {
    color: '#fff',
    fontWeight: '600',
  },
});
