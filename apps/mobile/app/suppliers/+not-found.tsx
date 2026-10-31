// app/suppliers/+not-found.tsx
import { Link, Stack } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function SuppliersNotFound() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Fournisseurs' }} />
      <Text style={styles.title}>Espace Fournisseurs</Text>
      <Text style={styles.subtitle}>GÃƒÂ©rez votre prÃƒÂ©sence sur ASMA Express</Text>
      
      <View style={styles.actions}>
        <Link href="/suppliers/register" asChild>
          <TouchableOpacity style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Devenir Fournisseur</Text>
          </TouchableOpacity>
        </Link>
        
        <Link href="/suppliers/login" asChild>
          <TouchableOpacity style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Connexion</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  actions: {
    gap: 12,
    width: '100%',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  secondaryButton: {
    borderColor: '#007AFF',
    borderWidth: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontWeight: '600',
  },
});
