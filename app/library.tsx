import { StyleSheet, Text, View } from 'react-native';

export default function LibraryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Library</Text>
      <Text style={styles.body}>
        Premium users keep their upload history here. Once Apple IAP + Supabase profile wiring is
        done we will gate the paginated list by `user_is_premium`, otherwise show the upgrade CTA.
      </Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Next steps</Text>
        <Text style={styles.cardBody}>
          1. Hook up the `/library` TanStack query fetching signed GET URLs.
        </Text>
        <Text style={styles.cardBody}>
          2. Surface pagination + empty states with pessimistic refetch handling.
        </Text>
        <Text style={styles.cardBody}>3. Integrate Apple purchase / restore flows.</Text>
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
