import { StyleSheet, Text, View } from 'react-native';

export default function Library() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>No plants yet</Text>
      <Text style={styles.subtitle}>Scan your first plant to get started.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 22, fontWeight: '600' },
  subtitle: { fontSize: 16, color: '#555' },
});
