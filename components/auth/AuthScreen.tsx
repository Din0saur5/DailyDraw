import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from '@/constants/policies';
import { palette } from '@/constants/palette';
import { supabase } from '@/lib/supabase';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type AuthMode = 'signIn' | 'signUp';

type Props = {
  allowDevBypass: boolean;
  onDevBypass: () => void;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthScreen({ allowDevBypass, onDevBypass }: Props) {
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);

  const supabaseReady = Boolean(supabase);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    const trimmedEmail = email.trim();

    if (!emailPattern.test(trimmedEmail)) {
      nextErrors.email = 'Enter a valid email.';
    }

    if (password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters.';
    }

    if (mode === 'signUp') {
      if (password !== confirmPassword) {
        nextErrors.confirmPassword = 'Passwords must match.';
      }
      if (!acceptedPolicies) {
        nextErrors.policies = 'You must agree to the policies.';
      }
    }

    return nextErrors;
  };

  const handleSubmit = async () => {
    setFormMessage(null);
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    if (!supabase) {
      setFormMessage({ type: 'error', text: 'Supabase client is not configured.' });
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    const trimmedEmail = email.trim().toLowerCase();

    try {
      if (mode === 'signIn') {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo: Linking.createURL('/auth/confirm'),
          },
        });
        if (error) {
          throw error;
        }
        setFormMessage({
          type: 'info',
          text: 'Check your email to confirm your account before signing in.',
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to complete request.';
      setFormMessage({ type: 'error', text: message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    setFormMessage(null);
    const trimmedEmail = email.trim().toLowerCase();

    if (!emailPattern.test(trimmedEmail)) {
      setFieldErrors({ email: 'Enter your email to reset your password.' });
      return;
    }

    if (!supabase) {
      setFormMessage({ type: 'error', text: 'Supabase client is not configured.' });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: Linking.createURL('/reset-password'),
      });
      if (error) {
        throw error;
      }
      setFormMessage({
        type: 'info',
        text: 'Password reset link sent. Check your inbox.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send reset link.';
      setFormMessage({ type: 'error', text: message });
    } finally {
      setSubmitting(false);
    }
  };

  const tabs: Array<{ label: string; value: AuthMode }> = [
    { label: 'Sign In', value: 'signIn' },
    { label: 'Create Account', value: 'signUp' },
  ];

  const passwordContentType = mode === 'signUp' ? 'newPassword' : 'password';
  const passwordAutoComplete = mode === 'signUp' ? 'password-new' : 'password';

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollBody}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Welcome to DailyDraw</Text>
          <Text style={styles.helper}>
            Use your Supabase email and password to continue. Accounts are shared between Expo dev
            builds and production.
          </Text>
          <View style={styles.tabRow}>
            {tabs.map((tab) => {
              const selected = tab.value === mode;
              return (
                <Pressable
                  key={tab.value}
                  style={[styles.tabButton, selected && styles.tabButtonSelected]}
                  onPress={() => {
                    setMode(tab.value);
                    if (tab.value === 'signIn') {
                      setAcceptedPolicies(false);
                    }
                  }}
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              style={[styles.input, fieldErrors.email && styles.inputError]}
              placeholder="you@example.com"
              editable={supabaseReady}
            />
            {fieldErrors.email && <Text style={styles.errorText}>{fieldErrors.email}</Text>}
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType={passwordContentType}
              autoComplete={passwordAutoComplete as any}
              style={[styles.input, fieldErrors.password && styles.inputError]}
              placeholder="Minimum 8 characters"
              editable={supabaseReady}
            />
            {fieldErrors.password && <Text style={styles.errorText}>{fieldErrors.password}</Text>}
          </View>
          {mode === 'signUp' && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Confirm Password</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                textContentType="newPassword"
                autoComplete="password-new"
                style={[styles.input, fieldErrors.confirmPassword && styles.inputError]}
                placeholder="Re-enter your password"
                editable={supabaseReady}
              />
              {fieldErrors.confirmPassword && (
                <Text style={styles.errorText}>{fieldErrors.confirmPassword}</Text>
              )}
            </View>
          )}
          {mode === 'signUp' && (
            <Pressable
              style={styles.checkboxRow}
              onPress={() => {
                setAcceptedPolicies((prev) => {
                  const next = !prev;
                  if (next && fieldErrors.policies) {
                    setFieldErrors((current) => {
                      const { policies: _policies, ...rest } = current;
                      return rest;
                    });
                  }
                  return next;
                });
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptedPolicies }}
              hitSlop={8}
            >
              <View style={[styles.checkboxBox, acceptedPolicies && styles.checkboxBoxChecked]}>
                {acceptedPolicies && <Text style={styles.checkboxCheck}>✓</Text>}
              </View>
              <View style={styles.checkboxLabelContainer}>
                <Text style={styles.checkboxText}>
                  By signing up you agree to DailyDrawings'
                  <Text
                    style={styles.linkText}
                    onPress={(event) => {
                      event.stopPropagation();
                      Linking.openURL(PRIVACY_POLICY_URL);
                    }}
                  >
                    {' '}
                    Privacy Policy
                  </Text>{' '}
                  and
                  <Text
                    style={styles.linkText}
                    onPress={(event) => {
                      event.stopPropagation();
                      Linking.openURL(TERMS_OF_USE_URL);
                    }}
                  >
                    {' '}
                    Terms of Use
                  </Text>
                  .
                </Text>
                {fieldErrors.policies && (
                  <Text style={styles.errorText}>{fieldErrors.policies}</Text>
                )}
              </View>
            </Pressable>
          )}
          {formMessage && (
            <Text style={[styles.formMessage, formMessage.type === 'error' && styles.errorText]}>
              {formMessage.text}
            </Text>
          )}
          <Pressable
            style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {mode === 'signIn' ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </Pressable>
          <Pressable style={styles.linkButton} onPress={handleForgotPassword} disabled={submitting}>
            <Text style={styles.linkText}>Forgot password?</Text>
          </Pressable>
          {!supabaseReady && (
            <Text style={styles.errorText}>
              Supabase credentials are missing. Set `EXPO_PUBLIC_SUPABASE_URL` and
              `EXPO_PUBLIC_SUPABASE_ANON_KEY` to continue.
            </Text>
          )}
          {/* {allowDevBypass && (
            <Pressable style={styles.secondaryButton} onPress={onDevBypass}>
              <Text style={styles.secondaryButtonText}>Bypass auth (dev only)</Text>
            </Pressable>
          )} */}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  flex: {
    flex: 1,
  },
  scrollBody: {
    flexGrow: 1,
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: palette.black,
  },
  helper: {
    color: '#4b5563',
    lineHeight: 20,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: palette.gray,
    borderRadius: 999,
    backgroundColor: '#fffef8',
  },
  tabButtonSelected: {
    backgroundColor: palette.black,
    borderColor: palette.black,
  },
  tabLabel: {
    textAlign: 'center',
    fontWeight: '600',
    color: '#4b5563',
  },
  tabLabelSelected: {
    color: '#fff',
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontWeight: '600',
    color: palette.black,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.gray,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: palette.black,
    backgroundColor: '#fffef8',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#b91c1c',
  },
  formMessage: {
    color: '#2563eb',
  },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: palette.black,
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
  secondaryButton: {
    marginTop: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.gray,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    textAlign: 'center',
    color: '#4b5563',
    fontWeight: '600',
  },
  linkButton: {
    alignSelf: 'center',
  },
  linkText: {
    color: '#2563eb',
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  checkboxBox: {
    height: 22,
    width: 22,
    borderWidth: 1,
    borderColor: palette.gray,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fffef8',
    marginTop: 4,
  },
  checkboxBoxChecked: {
    backgroundColor: palette.black,
    borderColor: palette.black,
  },
  checkboxCheck: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 16,
  },
  checkboxLabelContainer: {
    flex: 1,
  },
  checkboxText: {
    color: palette.black,
    lineHeight: 20,
  },
});
