import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

const today = new Date().toISOString().slice(0, 10);
const mockDifficulties = ['very easy', 'easy', 'medium', 'advanced'] as const;

export default function TodayScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Today&apos;s Four</Text>
      <Text style={styles.subheading}>
        This screen will call `/prompts/today` via TanStack Query and render prompt cards. For now
        use the links below to navigate to the thread template for each difficulty.
      </Text>
      <View style={styles.grid}>
        {mockDifficulties.map((difficulty) => (
          <Link
            key={difficulty}
            href={{ pathname: '/t/[date]/[difficulty]', params: { date: today, difficulty } }}
            style={styles.card}
          >
            <Text style={styles.cardLabel}>{difficulty.toUpperCase()}</Text>
            <Text style={styles.cardTitle}>Prompt placeholder</Text>
            <Text style={styles.cardHint}>Tap to open the thread</Text>
          </Link>
        ))}
      </View>
      <View style={styles.footerLinks}>
        <Link href="/library" style={styles.footerLink}>
          Library
        </Link>
        <Link href="/settings" style={styles.footerLink}>
          Settings
        </Link>
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
    fontSize: 28,
    fontWeight: '700',
  },
  subheading: {
    color: '#555',
  },
  grid: {
    gap: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 16,
    backgroundColor: '#fff',
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  cardTitle: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '600',
  },
  cardHint: {
    marginTop: 4,
    color: '#888',
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 'auto',
  },
  footerLink: {
    fontWeight: '600',
    color: '#1f75ff',
  },
});
