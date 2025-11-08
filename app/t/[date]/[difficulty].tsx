import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function ThreadScreen() {
  const { date, difficulty } = useLocalSearchParams<{ date?: string; difficulty?: string }>();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `${difficulty ?? 'Thread'} · ${date ?? ''}` }} />
      <Text style={styles.heading}>Prompt Thread</Text>
      <Text style={styles.body}>
        This flow will fetch prompt details, show the upload sheet, and render the moderated feed.
        The upload mutation will pipe through `/uploads/sign` ➜ R2 PUT ➜ `/submissions/create`. Once
        wired, this screen will also host the report sheet and pessimistic update states.
      </Text>
      <View style={styles.placeholderCard}>
        <Text style={styles.cardTitle}>Upload placeholder</Text>
        <Text style={styles.cardBody}>
          Drop in the actual picker + caption UI after the media pipeline work lands.
        </Text>
      </View>
      <View style={styles.placeholderCard}>
        <Text style={styles.cardTitle}>Feed placeholder</Text>
        <Text style={styles.cardBody}>
          Infinite list of submissions, each requesting `/images/sign-get` for a short-lived URL and
          wiring the community reporting affordance.
        </Text>
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
    color: '#444',
    lineHeight: 20,
  },
  placeholderCard: {
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardBody: {
    color: '#666',
  },
});
