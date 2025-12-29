// app/become-supplier/index.tsx
import { Link } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Stack } from 'expo-router';

export default function BecomeSupplierHome() {
  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: "Devenir Fournisseur" }} />
      
      <View style={styles.hero}>
        <Text style={styles.title}>Devenir Fournisseur ASMA Express</Text>
        <Text style={styles.subtitle}>
          Vendez vos produits ÃƒÂ  des acheteurs B2B du monde entier
        </Text>
      </View>

      <View style={styles.actions}>
        <Link href="/suppliers/register" asChild>
          <TouchableOpacity style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Commencer l'inscription</Text>
          </TouchableOpacity>
        </Link>
        
        <Link href="/suppliers" asChild>
          <TouchableOpacity style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Voir les fournisseurs</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: 'white' },
  hero: { alignItems: 'center', marginVertical: 40 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center' },
  actions: { gap: 12, marginTop: 30 },
  primaryButton: { backgroundColor: '#007AFF', padding: 16, borderRadius: 8, alignItems: 'center' },
  primaryButtonText: { color: 'white', fontWeight: '600' },
  secondaryButton: { borderColor: '#007AFF', borderWidth: 1, padding: 16, borderRadius: 8, alignItems: 'center' },
  secondaryButtonText: { color: '#007AFF', fontWeight: '600' },
});