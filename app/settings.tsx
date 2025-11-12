import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useSessionStore } from '@/stores/useSessionStore';
import { useSetUsernameMutation } from '@/lib/mutations/username';
import { useDeleteAccountMutation } from '@/lib/mutations/account';
import { supabase } from '@/lib/supabase';
import { validateUsernameInput, formatUtcToday } from '@/lib/validation';
import { palette } from '@/constants/palette';

export default function SettingsScreen() {
  const profile = useSessionStore((state) => state.profile);
  const setProfile = useSessionStore((state) => state.setProfile);
  const setSession = useSessionStore((state) => state.setSession);
  const setStatus = useSessionStore((state) => state.setStatus);
  const setDevBypass = useSessionStore((state) => state.setDevBypass);
  const [username, setUsername] = useState(profile?.username ?? '');
  const [localError, setLocalError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const setUsernameMutation = useSetUsernameMutation();
  const {
    mutateAsync: deleteAccount,
    isPending: isDeletingAccount,
  } = useDeleteAccountMutation();

  useEffect(() => {
    setUsername(profile?.username ?? '');
  }, [profile?.username]);

  const subscriptionLabel = profile?.isPremium ? 'Premium' : 'Free (resets daily)';
  const utcPromptDate = useMemo(() => formatUtcToday(), []);

  const handleUsernameSave = useCallback(async () => {
    setStatusMessage(null);
    const validation = validateUsernameInput(username);
    if (validation) {
      setLocalError(validation);
      return;
    }
    if (username === profile?.username) {
      setLocalError('Please enter a new username to continue.');
      return;
    }
    try {
      setLocalError(null);
      await setUsernameMutation.mutateAsync({ username });
      setStatusMessage('Username updated successfully.');
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Unable to update username.');
    }
  }, [profile?.username, setUsernameMutation, username]);

  const handleLogout = useCallback(async () => {
    try {
      await supabase?.auth.signOut();
    } finally {
      setSession(null);
      setProfile(null);
      setDevBypass(false);
      setStatus('unauthenticated');
    }
  }, [setDevBypass, setProfile, setSession, setStatus]);

  const handleDeleteAccount = useCallback(() => {
    if (isDeletingAccount) return;

    Alert.alert(
      'Delete account',
      'This permanently removes your profile and submissions. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
            } catch (error) {
              Alert.alert(
                'Unable to delete account',
                error instanceof Error ? error.message : 'Please try again later.',
              );
            }
          },
        },
      ],
    );
  }, [deleteAccount, isDeletingAccount]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Settings</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Profile</Text>
        <Text style={styles.cardBody}>Username: {profile?.username ?? 'Loading…'}</Text>
        <Text style={styles.cardBody}>Subscription: {subscriptionLabel}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Change username</Text>
        <TextInput
          value={username}
          onChangeText={(value) => {
            setUsername(value);
            if (localError) setLocalError(null);
            if (statusMessage) setStatusMessage(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          placeholder="artist_name"
          placeholderTextColor="#9ca3af"
        />
        {localError && <Text style={styles.errorText}>{localError}</Text>}
        {statusMessage && <Text style={styles.successText}>{statusMessage}</Text>}
        <Pressable
          style={[styles.primaryButton, setUsernameMutation.isPending && styles.disabledButton]}
          disabled={setUsernameMutation.isPending}
          onPress={handleUsernameSave}
        >
          <Text style={styles.primaryButtonText}>
            {setUsernameMutation.isPending ? 'Saving…' : 'Save username'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Logout</Text>
        <Text style={styles.cardBody}>Sign out of DailyDraw on this device.</Text>
        <Pressable style={styles.secondaryButton} onPress={handleLogout}>
          <Text style={styles.secondaryButtonText}>Logout</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Delete account</Text>
        <Text style={styles.cardBody}>
          Permanently remove your account and submissions from DailyDraw. This cannot be undone.
        </Text>
        <Pressable
          style={[styles.destructiveButton, isDeletingAccount && styles.disabledButton]}
          disabled={isDeletingAccount}
          onPress={handleDeleteAccount}
        >
          <Text style={styles.destructiveButtonText}>
            {isDeletingAccount ? 'Deleting…' : 'Delete account'}
          </Text>
        </Pressable>
      </View>

      {__DEV__ && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Debug info (dev only)</Text>
          <Text style={styles.cardBody}>User ID: {profile?.id ?? 'unknown'}</Text>
          <Text style={styles.cardBody}>UTC prompt date: {utcPromptDate}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    gap: 16,
    backgroundColor: palette.canvas,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
  },
  body: {
    color: '#555',
  },
  card: {
    borderWidth: 1,
    borderColor: palette.gray,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    backgroundColor: '#fffef8',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.black,
  },
  cardBody: {
    color: '#4b5563',
  },
  input: {
    borderWidth: 1,
    borderColor: palette.gray,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: palette.black,
    backgroundColor: '#fffef8',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
  },
  successText: {
    color: '#047857',
    fontSize: 13,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: palette.black,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.gray,
  },
  secondaryButtonText: {
    color: palette.black,
    fontWeight: '600',
  },
  destructiveButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#b91c1c',
  },
  destructiveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
