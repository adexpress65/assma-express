import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  TextInput, ActivityIndicator, Image, Alert 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, query, orderBy, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../src/config/firebase'; // ✅ Chemin corrigé selon ton arborescence
import { LinearGradient } from 'expo-linear-gradient';

interface Company {
  id: string;
  name: string;
  email: string;
  status: 'pending' | 'active' | 'rejected';
  logo?: string;
  category?: string;
  createdAt?: any;
}

export default function CompaniesManagement() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'companies'), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Company));
      setCompanies(data);
    } catch (error) {
      console.error("Erreur Firestore:", error);
      Alert.alert("Erreur", "Impossible de charger les entreprises.");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const companyRef = doc(db, 'companies', id);
      await updateDoc(companyRef, { status: newStatus });
      Alert.alert("Succès", `Fournisseur ${newStatus === 'active' ? 'approuvé' : 'suspendu'}.`);
      fetchCompanies(); // Rafraîchir
    } catch (error) {
      Alert.alert("Erreur", "Action impossible.");
    }
  };

  const confirmDelete = (id: string) => {
    Alert.alert(
      "Supprimer",
      "Voulez-vous vraiment supprimer cette entreprise ?",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: () => deleteCompany(id) }
      ]
    );
  };

  const deleteCompany = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'companies', id));
      fetchCompanies();
    } catch (error) {
      Alert.alert("Erreur", "Suppression échouée.");
    }
  };

  const renderCompanyItem = ({ item }: { item: Company }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Image 
          source={{ uri: item.logo || 'https://via.placeholder.com/100' }} 
          style={styles.logo} 
        />
        <View style={styles.infoContainer}>
          <Text style={styles.companyName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.companyEmail} numberOfLines={1}>{item.email || "Pas d'email"}</Text>
          <View style={styles.badgeRow}>
             <View style={[styles.statusBadge, { backgroundColor: item.status === 'active' ? '#E8F5E9' : '#FFF3E0' }]}>
                <Text style={[styles.statusText, { color: item.status === 'active' ? '#2E7D32' : '#EF6C00' }]}>
                    {item.status === 'active' ? 'Validé' : 'En attente'}
                </Text>
             </View>
             {item.category && (
               <View style={styles.categoryBadge}>
                 <Text style={styles.categoryText}>{item.category}</Text>
               </View>
             )}
          </View>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.btnAction} onPress={() => router.push(`/company/${item.id}`)}>
          <Ionicons name="eye" size={18} color="#666" />
          <Text style={styles.btnText}>Détails</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.btnAction} 
          onPress={() => handleStatusChange(item.id, item.status === 'active' ? 'pending' : 'active')}
        >
          <Ionicons 
            name={item.status === 'active' ? "pause-circle" : "checkmark-circle"} 
            size={18} 
            color={item.status === 'active' ? "#FFA000" : "#4CAF50"} 
          />
          <Text style={[styles.btnText, { color: item.status === 'active' ? "#FFA000" : "#4CAF50" }]}>
            {item.status === 'active' ? "Suspendre" : "Valider"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnAction} onPress={() => confirmDelete(item.id)}>
          <Ionicons name="trash" size={18} color="#F44336" />
          <Text style={[styles.btnText, { color: "#F44336" }]}>Suppr.</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#FF6B00', '#E65100']} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Fournisseurs ({companies.length})</Text>
          <TouchableOpacity 
            onPress={() => router.push('/super-admin/companies/add')}
            style={styles.addBtn}
          >
            <Ionicons name="add" size={24} color="#FF6B00" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#999" />
          <TextInput 
            placeholder="Rechercher une société..." 
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#999"
          />
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={styles.loaderText}>Synchronisation...</Text>
        </View>
      ) : (
        <FlatList
          data={companies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))}
          keyExtractor={(item) => item.id}
          renderItem={renderCompanyItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
                <Ionicons name="business-outline" size={80} color="#DDD" />
                <Text style={styles.emptyText}>Aucune entreprise enregistrée.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FA' },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 25, borderBottomLeftRadius: 35, borderBottomRightRadius: 35 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  backBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 5 },
  addBtn: { backgroundColor: '#FFF', borderRadius: 12, padding: 8, elevation: 5 },
  searchContainer: { 
    flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 18, 
    paddingHorizontal: 15, height: 50, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 4
  },
  searchInput: { marginLeft: 10, flex: 1, fontSize: 15, color: '#333' },
  list: { padding: 20, paddingBottom: 100 },
  card: { 
    backgroundColor: '#FFF', borderRadius: 22, padding: 18, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 65, height: 65, borderRadius: 18, backgroundColor: '#F0F0F0' },
  infoContainer: { flex: 1, marginLeft: 15 },
  companyName: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginBottom: 2 },
  companyEmail: { fontSize: 13, color: '#777', marginBottom: 8 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
  categoryBadge: { backgroundColor: '#F0F0F0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  categoryText: { fontSize: 11, color: '#666', fontWeight: '600' },
  cardActions: { 
    flexDirection: 'row', marginTop: 18, paddingTop: 15, 
    borderTopWidth: 1, borderTopColor: '#F5F5F5', justifyContent: 'space-between'
  },
  btnAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  btnText: { fontSize: 13, fontWeight: '700', color: '#666' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loaderText: { marginTop: 10, color: '#FF6B00', fontWeight: '600' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 10, color: '#BBB', fontSize: 16 }
});
