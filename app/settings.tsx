import { StyleSheet, Text, View } from 'react-native';
import { useSessionStore } from '@/stores/useSessionStore';

export default function SettingsScreen() {
  const profile = useSessionStore((state) => state.profile);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Settings</Text>
      <Text style={styles.body}>
        This screen will house username management, logout, and debug utilities as described in the
        build spec.
      </Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Profile snapshot</Text>
        <Text style={styles.cardBody}>Username: {profile?.username ?? 'pending'}</Text>
        <Text style={styles.cardBody}>
          Subscription: {profile?.isPremium ? 'Premium' : 'Free (reset daily)'}
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Upcoming tasks</Text>
        <Text style={styles.cardBody}>• Wire change-username form → `/username/set`.</Text>
        <Text style={styles.cardBody}>
          • Add logout button that clears Supabase session + store.
        </Text>
        <Text style={styles.cardBody}>• Show debug info (prompt date, user id) in dev builds.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 16,
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
    borderColor: '#e1e1e1',
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardBody: {
    color: '#666',
  },
});
