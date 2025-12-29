// app/suppliers/dashboard.tsx
import { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert 
} from 'react-native';
import { Stack, router } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
// app/suppliers/register.tsx
import { auth, db } from '../../src/config/firebase'; // IMPORT CORRIGÉ

interface Company {
  id: string;
  name: string;
  description: string;
  verification: {
    status: string;
    badges: string[];
    verified: boolean;
  };
  stats: {
    productCount: number;
    orderCount: number;
    rating: number;
    reviewCount: number;
  };
}

export default function SupplierDashboard() {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Écouter les changements sur le document company
        const unsubscribeCompany = onSnapshot(
          doc(db, 'companies', user.uid),
          (doc) => {
            if (doc.exists()) {
              setCompany(doc.data() as Company);
            }
            setLoading(false);
          },
          (error) => {
            console.error('Error fetching company:', error);
            setLoading(false);
          }
        );

        return unsubscribeCompany;
      } else {
        setLoading(false);
        router.replace('/suppliers');
      }
    });

    return unsubscribeAuth;
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace('/suppliers');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de se déconnecter');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Chargement...</Text>
      </View>
    );
  }

  if (!company) {
    return (
      <View style={styles.container}>
        <Text>Entreprise non trouvée</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: 'Dashboard Fournisseur' }} />
      
      {/* En-tête */}
      <View style={styles.header}>
        <View>
          <Text style={styles.companyName}>{company.name}</Text>
          <Text style={styles.status}>
            Statut: {company.verification.status}
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
      </View>

      {/* Statistiques */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Vos Statistiques</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{company.stats.productCount}</Text>
            <Text style={styles.statLabel}>Produits</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{company.stats.orderCount}</Text>
            <Text style={styles.statLabel}>Commandes</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {company.stats.rating > 0 ? company.stats.rating.toFixed(1) : '-'}
            </Text>
            <Text style={styles.statLabel}>Note</Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>Gestion</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.actionCard}>
            <Text style={styles.actionTitle}>Produits</Text>
            <Text style={styles.actionDesc}>Gérer votre catalogue</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionCard}>
            <Text style={styles.actionTitle}>Commandes</Text>
            <Text style={styles.actionDesc}>Voir les commandes</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0' 
  },
  companyName: { fontSize: 20, fontWeight: 'bold' },
  status: { fontSize: 14, color: '#666' },
  logoutButton: { padding: 8 },
  logoutText: { color: '#007AFF', fontWeight: '600' },
  statsSection: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  statsGrid: { flexDirection: 'row', gap: 12 },
  statCard: { 
    flex: 1, 
    backgroundColor: '#f8f8f8', 
    padding: 16, 
    borderRadius: 8, 
    alignItems: 'center' 
  },
  statNumber: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  statLabel: { fontSize: 14, color: '#666' },
  actionsSection: { padding: 20 },
  actionsGrid: { gap: 12 },
  actionCard: { 
    backgroundColor: '#f8f8f8', 
    padding: 16, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#e0e0e0' 
  },
  actionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  actionDesc: { fontSize: 14, color: '#666' },
});