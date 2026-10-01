import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../src/config/firebase'; 
import { Ionicons } from '@expo/vector-icons';
import { useOperationalStaffAccess } from '@/hooks/useOperationalStaffAccess';

export default function CompanyDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { allowed, isLoading: accessLoading } = useOperationalStaffAccess();
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!allowed) return;
    const fetchCompanyDetails = async () => {
      try {
        if (!id) return;
        const docRef = doc(db, 'companies', id as string);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setCompany({ id: docSnap.id, ...docSnap.data() });
        } else {
          Alert.alert("Erreur", "Entreprise introuvable");
          router.back();
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanyDetails();
  }, [id, allowed]);

  if (accessLoading || !allowed) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" color="#2563EB" />;
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#FF6B00" />;
  if (!company) return <View style={styles.container}><Text>Aucune donnée trouvée.</Text></View>;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détails du dossier</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Nom de l'entreprise</Text>
        <Text style={styles.value}>{company.name}</Text>

        <Text style={styles.label}>Email professionnel</Text>
        <Text style={styles.value}>{company.email}</Text>

        <Text style={styles.label}>Statut actuel</Text>
        <View style={[styles.statusBadge, { backgroundColor: company.verification?.status === 'verified' ? '#D1FAE5' : '#FEF3C7' }]}>
          <Text style={{ color: company.verification?.status === 'verified' ? '#065F46' : '#92400E' }}>
            {company.verification?.status?.toUpperCase() || 'EN ATTENTE'}
          </Text>
        </View>
      </View>

      {/* C'est ici que vous pourrez ajouter l'affichage des images de documents (ID, KBIS, etc.) */}
      <View style={styles.card}>
         <Text style={styles.label}>Documents fournis</Text>
         <Text style={styles.placeholderText}>Ici s'afficheront les photos des documents...</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: '#FFF', gap: 15 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  card: { backgroundColor: '#FFF', margin: 15, padding: 20, borderRadius: 12, elevation: 2 },
  label: { fontSize: 12, color: '#999', textTransform: 'uppercase', marginBottom: 5 },
  value: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 20 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  placeholderText: { color: '#CCC', fontStyle: 'italic', marginTop: 10 }
});
