import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<{ type: 'error' | 'info'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleReset = async () => {
    setStatus(null);

    if (password.length < 8) {
      setStatus({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }

    if (password !== confirmPassword) {
      setStatus({ type: 'error', text: 'Passwords must match.' });
      return;
    }

    if (!supabase) {
      setStatus({ type: 'error', text: 'Supabase client is not configured.' });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        throw error;
      }
      setStatus({ type: 'info', text: 'Password updated. Redirecting…' });
      setTimeout(() => {
        router.replace('/');
      }, 1200);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update password.';
      setStatus({ type: 'error', text: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Reset your password</Text>
          <Text style={styles.helper}>
            This screen opens automatically after tapping the password reset link emailed to you.
          </Text>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>New password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="newPassword"
              autoComplete="password-new"
              placeholder="Minimum 8 characters"
              style={styles.input}
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Confirm password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="newPassword"
              autoComplete="password-new"
              placeholder="Repeat your password"
              style={styles.input}
            />
          </View>
          {status && (
            <Text style={[styles.statusText, status.type === 'error' && styles.errorText]}>
              {status.text}
            </Text>
          )}
          <Pressable
            style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
            onPress={handleReset}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Update password</Text>
            )}
          </Pressable>
          <Pressable style={styles.linkButton} onPress={() => router.replace('/')}>
            <Text style={styles.linkText}>Back to sign in</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  helper: {
    color: '#4b5563',
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontWeight: '600',
    color: '#111827',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  statusText: {
    color: '#2563eb',
  },
  errorText: {
    color: '#b91c1c',
  },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: '#111827',
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  linkButton: {
    alignSelf: 'center',
  },
  linkText: {
    color: '#2563eb',
    fontWeight: '600',
  },
});
