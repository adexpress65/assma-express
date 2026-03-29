import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  Alert, ActivityIndicator, RefreshControl, Platform 
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
// 1. Importation de expo-image
import { Image } from 'expo-image';
import { auth, db } from '../../src/config/firebase';
import { signOut } from 'firebase/auth';
import { 
  doc, getDoc, collection, query, where, getDocs, deleteDoc 
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

const blurhash = '|rF?hV%2WCj[ayayj[azj[j[ayayayayayayayayj[';

export default function SupplierDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const [myProducts, setMyProducts] = useState<any[]>([]);

  // 2. RÉCUPÉRATION PARALLÈLE (PLUS RAPIDE)
  const fetchData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        router.replace('/suppliers');
        return;
      }

      // On lance les deux requêtes EN MÊME TEMPS
      const companyPromise = getDoc(doc(db, 'companies', user.uid));
      
      const productsQuery = query(
        collection(db, 'products'), 
        where('companyId', '==', user.uid)
      );
      const productsPromise = getDocs(productsQuery);

      // On attend les deux résultats
      const [companySnap, productSnap] = await Promise.all([companyPromise, productsPromise]);

      if (companySnap.exists()) {
        setCompany(companySnap.data());
      }

      const productsList = productSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setMyProducts(productsList);
    } catch (error) {
      console.error("Erreur Dashboard:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace('/suppliers');
    } catch (error) {
      Alert.alert('Erreur', 'Déconnexion impossible');
    }
  };

  const confirmDelete = (id: string, name: string) => {
    Alert.alert(
      "Supprimer le produit",
      `Voulez-vous vraiment supprimer "${name}" ?`,
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Supprimer", 
          style: "destructive", 
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'products', id));
              fetchData();
            } catch (e) {
              Alert.alert("Erreur", "Impossible de supprimer");
            }
          } 
        }
      ]
    );
  };

  // CALCULS
  const totalSold = myProducts.reduce((acc, p) => acc + (p.soldCount || 0), 0);
  const totalRevenue = myProducts.reduce((acc, p) => acc + ((p.soldCount || 0) * (p.price || 0)), 0);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={{marginTop: 10, color: '#6B7280'}}>Chargement de l'espace A2Express...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} color="#FF6B00" />}
    >
      <Stack.Screen options={{ title: 'Espace Vendeur', headerLeft: () => null }} />
      
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Bonjour,</Text>
          <Text style={styles.companyName}>{company?.name || 'Ma Boutique'}</Text>
          
          <View style={[
            styles.statusBadge, 
            { backgroundColor: company?.verification?.status === 'verified' ? '#D1FAE5' : '#FEF3C7' }
          ]}>
            <Text style={[
              styles.statusText, 
              { color: company?.verification?.status === 'verified' ? '#065F46' : '#92400E' }
            ]}>
              {company?.verification?.status === 'verified' ? 'Compte Actif' : 'Vérification en cours'}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.logoutCircle} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={22} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* COMPTABILITÉ */}
      <View style={styles.accountingSection}>
        <Text style={styles.sectionTitle}>Comptabilité & Ventes</Text>
        <View style={styles.revenueCard}>
          <View>
            <Text style={styles.revenueLabel}>Chiffre d'affaires estimé</Text>
            <Text style={styles.revenueValue}>{totalRevenue.toLocaleString()} FCFA</Text>
          </View>
          <View style={styles.revenueIcon}>
            <Ionicons name="wallet" size={30} color="#FFF" />
          </View>
        </View>
        
        <View style={styles.statsGrid}>
          <View style={styles.statMiniCard}>
            <Text style={styles.statMiniLabel}>Ventes</Text>
            <Text style={styles.statMiniValue}>{totalSold}</Text>
          </View>
          <View style={styles.statMiniCard}>
            <Text style={styles.statMiniLabel}>Produits</Text>
            <Text style={styles.statMiniValue}>{myProducts.length}</Text>
          </View>
        </View>
      </View>

      {/* ACTIONS RAPIDES */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={[
            styles.addBtn, 
            company?.verification?.status !== 'verified' && { backgroundColor: '#9CA3AF', elevation: 0 }
          ]} 
          onPress={() => {
            if (company?.verification?.status === 'verified') {
              router.push('/seller/add-product');
            } else {
              Alert.alert("Validation requise", "Votre boutique est en cours d'examen.");
            }
          }}
          activeOpacity={company?.verification?.status === 'verified' ? 0.7 : 1}
        >
          <Ionicons 
            name={company?.verification?.status === 'verified' ? "add-circle" : "lock-closed"} 
            size={24} 
            color="#fff" 
          />
          <Text style={styles.addBtnText}>
            {company?.verification?.status === 'verified' ? "Ajouter un produit" : "Publication verrouillée"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* CATALOGUE PRODUITS */}
      <View style={styles.catalogContainer}>
        <Text style={styles.sectionTitle}>Gestion du Catalogue</Text>
        
        {myProducts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="basket-outline" size={48} color="#CCC" />
            <Text style={styles.emptyText}>Votre catalogue est vide.</Text>
          </View>
        ) : (
          myProducts.map((product, index) => (
            <View key={product.id || index} style={styles.productCard}>
              <Image 
                source={product.mainImage || product.imageUrl || 'https://via.placeholder.com/150'} 
                style={styles.productImg}
                contentFit="cover"
                transition={200}
                placeholder={blurhash}
                cachePolicy="memory-disk"
              />

              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                <Text style={styles.productPrice}>{product.price?.toLocaleString()} FCFA</Text>
                <View style={styles.productMeta}>
                  <Text style={styles.metaText}>Stock: {product.stockQuantity || 0} | {product.soldCount || 0} vendus</Text>
                </View>
              </View>

              <View style={styles.productActions}>
                <TouchableOpacity style={styles.editBtn} 
                  onPress={() => router.push({ pathname: '/seller/add-product', params: { editId: product.id } })}>
                  <Ionicons name="pencil" size={18} color="#4B5563" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.deleteBtn} onPress={() => confirmDelete(product.id, product.name)}>
                  <Ionicons name="trash" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ... Tes styles restent identiques
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomRightRadius: 20, borderBottomLeftRadius: 20, elevation: 3 },
  welcomeText: { fontSize: 14, color: '#6B7280' },
  companyName: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginTop: 5 },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  logoutCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },
  accountingSection: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937', marginBottom: 15 },
  revenueCard: { backgroundColor: '#1F2937', padding: 20, borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  revenueLabel: { color: '#9CA3AF', fontSize: 13 },
  revenueValue: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginTop: 5 },
  revenueIcon: { backgroundColor: '#374151', padding: 10, borderRadius: 12 },
  statsGrid: { flexDirection: 'row', gap: 15 },
  statMiniCard: { flex: 1, backgroundColor: '#FFF', padding: 15, borderRadius: 12, elevation: 1 },
  statMiniLabel: { color: '#6B7280', fontSize: 12 },
  statMiniValue: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginTop: 4 },
  actionsContainer: { paddingHorizontal: 20 },
  addBtn: { backgroundColor: '#FF6B00', flexDirection: 'row', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 10, elevation: 2 },
  addBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  catalogContainer: { padding: 20 },
  productCard: { flexDirection: 'row', backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 12, alignItems: 'center', elevation: 1 },
  productImg: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#F3F4F6' },
  productInfo: { flex: 1, marginLeft: 12 },
  productName: { fontSize: 15, fontWeight: 'bold', color: '#111827' },
  productPrice: { color: '#FF6B00', fontWeight: 'bold', marginTop: 2 },
  productMeta: { flexDirection: 'row', marginTop: 4 },
  metaText: { fontSize: 11, color: '#6B7280' },
  productActions: { flexDirection: 'row', gap: 5 },
  editBtn: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 8 },
  deleteBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#9CA3AF', marginTop: 10 }
});