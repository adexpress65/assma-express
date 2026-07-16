import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  Alert, ActivityIndicator, RefreshControl, Platform 
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
// 1. Importation de expo-image
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db } from '../../src/config/firebase';
import { signOut } from 'firebase/auth';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  limit,
  getCountFromServer,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

const blurhash = '|rF?hV%2WCj[ayayj[azj[j[ayayayayayayayayj[';

export default function SupplierDashboard() {
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const [myProducts, setMyProducts] = useState<any[]>([]);
  const [productCount, setProductCount] = useState(0);

  const PRODUCT_PREVIEW_LIMIT = 40;

  const loadCompany = async (userId: string) => {
    const companySnap = await getDoc(doc(db, 'companies', userId));
    if (companySnap.exists()) {
      setCompany(companySnap.data());
    } else {
      setCompany(null);
    }
  };

  const loadProductCount = async (userId: string) => {
    try {
      const byCompany = query(
        collection(db, 'products'),
        where('companyId', '==', userId),
      );
      const c1 = await getCountFromServer(byCompany);
      let total = c1.data().count;
      if (total === 0) {
        const bySupplier = query(
          collection(db, 'products'),
          where('supplierId', '==', userId),
        );
        const c2 = await getCountFromServer(bySupplier);
        total = c2.data().count;
      }
      setProductCount(total);
    } catch {
      setProductCount(0);
    }
  };

  const loadProductsPreview = async (userId: string) => {
    setProductsLoading(true);
    try {
      const productsQuery = query(
        collection(db, 'products'),
        where('companyId', '==', userId),
        limit(PRODUCT_PREVIEW_LIMIT),
      );
      const productSnap = await getDocs(productsQuery);
      const productsList = productSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setMyProducts(productsList);
    } catch (error) {
      console.error('Erreur produits dashboard:', error);
      setMyProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  const fetchData = async (isRefresh = false) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        router.replace('/suppliers');
        return;
      }
      if (!isRefresh) {
        setLoading(true);
      }

      // On charge d'abord les infos légères pour afficher l'écran rapidement.
      await loadCompany(user.uid);
      setLoading(false);

      // Produits + count en arrière-plan (ne bloque plus l'ouverture).
      await Promise.allSettled([loadProductsPreview(user.uid), loadProductCount(user.uid)]);
    } catch (error) {
      console.error('Erreur Dashboard:', error);
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData(false);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace('/suppliers');
    } catch (error) {
      Alert.alert(t('app.account.errorTitle'), t('app.account.logoutError'));
    }
  };

  const confirmDelete = (id: string, name: string) => {
    Alert.alert(
      t('app.supplier.dashboard.deleteProductTitle'),
      t('app.supplier.dashboard.deleteProductMessage', { name }),
      [
        { text: t('app.account.cancelAction'), style: "cancel" },
        { 
          text: t('app.cart.removeConfirm'), 
          style: "destructive", 
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'products', id));
              setMyProducts((prev) => prev.filter((p) => p.id !== id));
              setProductCount((prev) => Math.max(0, prev - 1));
              const userId = auth.currentUser?.uid;
              if (userId) {
                void loadProductCount(userId);
              }
            } catch (e) {
              Alert.alert(t('app.account.errorTitle'), t('app.supplier.dashboard.deleteProductError'));
            }
          } 
        }
      ]
    );
  };

  // CALCULS
  const totalSold = myProducts.reduce((acc, p) => acc + (p.soldCount || 0), 0);
  const totalRevenue = myProducts.reduce((acc, p) => acc + ((p.soldCount || 0) * (p.price || 0)), 0);
  const isCompanyVerified =
    company?.verification?.status === 'verified' ||
    company?.verification?.verified === true ||
    company?.verified === true;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={{marginTop: 10, color: '#6B7280'}}>{t('app.supplier.dashboard.loadingSpace')}</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} color="#FF6B00" />}
    >
      <Stack.Screen options={{ title: t('app.supplier.dashboard.sellerSpaceTitle'), headerLeft: () => null }} />
      
      {/* HEADER */}
      <LinearGradient colors={['#FFF7ED', '#FFFFFF']} style={styles.heroCard}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.welcomeText}>{t('app.supplier.dashboard.hello')}</Text>
            <Text style={styles.companyName}>{company?.name || 'Ma Boutique'}</Text>
            <Text style={styles.heroSubtitle}>{t('app.supplier.dashboard.heroSubtitle')}</Text>
            
            <View style={[
              styles.statusBadge, 
              { backgroundColor: isCompanyVerified ? '#D1FAE5' : '#FEF3C7' }
            ]}>
              <Ionicons
                name={isCompanyVerified ? 'checkmark-circle' : 'time-outline'}
                size={13}
                color={isCompanyVerified ? '#065F46' : '#92400E'}
              />
              <Text style={[
                styles.statusText, 
                { color: isCompanyVerified ? '#065F46' : '#92400E' }
              ]}>
                {isCompanyVerified ? t('app.supplier.dashboard.accountActive') : t('app.supplier.dashboard.verificationInProgress')}
              </Text>
            </View>
          </View>
          
          <TouchableOpacity style={styles.logoutCircle} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* COMPTABILITÉ */}
      <View style={styles.accountingSection}>
        <Text style={styles.sectionTitle}>{t('app.supplier.dashboard.accountingAndSales')}</Text>
        <View style={styles.revenueCard}>
          <View>
            <Text style={styles.revenueLabel}>{t('app.supplier.dashboard.estimatedRevenue')}</Text>
            <Text style={styles.revenueValue}>{totalRevenue.toLocaleString()} FCFA</Text>
          </View>
          <View style={styles.revenueIcon}>
            <Ionicons name="wallet" size={30} color="#FFF" />
          </View>
        </View>
        
        <View style={styles.statsGrid}>
          <View style={styles.statMiniCard}>
            <Text style={styles.statMiniLabel}>{t('app.supplier.dashboard.sales')}</Text>
            <Text style={styles.statMiniValue}>{totalSold}</Text>
          </View>
          <View style={styles.statMiniCard}>
            <Text style={styles.statMiniLabel}>{t('common.products')}</Text>
            <Text style={styles.statMiniValue}>{productCount}</Text>
          </View>
        </View>
      </View>

      {/* ACTIONS RAPIDES */}
      <View style={styles.actionsContainer}>
        <Text style={styles.sectionTitle}>{t('app.supplier.dashboard.quickActions')}</Text>
        <View style={styles.quickActionsRow}>
          <TouchableOpacity 
            style={[
              styles.addBtn, 
            !isCompanyVerified && { backgroundColor: '#9CA3AF', elevation: 0 }
            ]} 
            onPress={() => {
            if (isCompanyVerified) {
                router.push('/seller/add-product');
              } else {
                Alert.alert(t('app.supplier.dashboard.validationRequiredTitle'), t('app.supplier.dashboard.validationRequiredMessage'));
              }
            }}
          activeOpacity={isCompanyVerified ? 0.7 : 1}
          >
            <Ionicons 
            name={isCompanyVerified ? "add-circle" : "lock-closed"} 
              size={22} 
              color="#fff" 
            />
            <Text style={styles.addBtnText}>
            {isCompanyVerified ? t('app.account.addProduct') : t('app.supplier.dashboard.publicationLocked')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/suppliers/orders')}>
            <Ionicons name="receipt-outline" size={20} color="#111827" />
            <Text style={styles.secondaryBtnText}>{t('app.account.orders')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* CATALOGUE PRODUITS */}
      <View style={styles.catalogContainer}>
        <View style={styles.catalogTitleRow}>
          <Text style={styles.sectionTitle}>{t('app.supplier.dashboard.catalogManagement')}</Text>
          <Text style={styles.catalogCountText}>{myProducts.length} / {productCount}</Text>
        </View>
        
        {myProducts.length === 0 ? (
          productsLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="small" color="#FF6B00" />
              <Text style={styles.emptyText}>{t('app.supplier.dashboard.loadingProductsFast')}</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="basket-outline" size={48} color="#CCC" />
              <Text style={styles.emptyText}>{t('app.supplier.dashboard.emptyCatalog')}</Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => router.push('/seller/add-product')}
              >
                <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.emptyCtaText}>{t('app.supplier.dashboard.addFirstProduct')}</Text>
              </TouchableOpacity>
            </View>
          )
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
                  <Text style={styles.metaText}>{t('app.supplier.dashboard.stockAndSold', { stock: product.stockQuantity || 0, sold: product.soldCount || 0 })}</Text>
                  {(product.soldCount || 0) > 0 && (
                    <View style={styles.soldBadge}>
                      <Text style={styles.soldBadgeText}>{t('app.supplier.dashboard.topSelling')}</Text>
                    </View>
                  )}
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
  heroCard: {
    margin: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18 },
  welcomeText: { fontSize: 14, color: '#6B7280' },
  companyName: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  heroSubtitle: { marginTop: 4, fontSize: 13, color: '#6B7280' },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  logoutCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  accountingSection: { paddingHorizontal: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937', marginBottom: 15 },
  revenueCard: { backgroundColor: '#1F2937', padding: 20, borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  revenueLabel: { color: '#9CA3AF', fontSize: 13 },
  revenueValue: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginTop: 5 },
  revenueIcon: { backgroundColor: '#374151', padding: 10, borderRadius: 12 },
  statsGrid: { flexDirection: 'row', gap: 15 },
  statMiniCard: { flex: 1, backgroundColor: '#FFF', padding: 15, borderRadius: 12, elevation: 1 },
  statMiniLabel: { color: '#6B7280', fontSize: 12 },
  statMiniValue: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginTop: 4 },
  actionsContainer: { paddingHorizontal: 16, marginTop: 4 },
  quickActionsRow: { flexDirection: 'row', gap: 10 },
  addBtn: { backgroundColor: '#FF6B00', flexDirection: 'row', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 10, elevation: 2 },
  addBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 10,
  },
  secondaryBtnText: { color: '#111827', fontWeight: '700', fontSize: 14 },
  catalogContainer: { padding: 16 },
  catalogTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catalogCountText: { color: '#6B7280', fontSize: 12, fontWeight: '600' },
  productCard: { flexDirection: 'row', backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 12, alignItems: 'center', elevation: 1 },
  productImg: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#F3F4F6' },
  productInfo: { flex: 1, marginLeft: 12 },
  productName: { fontSize: 15, fontWeight: 'bold', color: '#111827' },
  productPrice: { color: '#FF6B00', fontWeight: 'bold', marginTop: 2 },
  productMeta: { flexDirection: 'row', marginTop: 4, alignItems: 'center', flexWrap: 'wrap' },
  metaText: { fontSize: 11, color: '#6B7280' },
  soldBadge: {
    marginLeft: 8,
    backgroundColor: '#ECFDF3',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  soldBadgeText: { color: '#047857', fontSize: 10, fontWeight: '700' },
  productActions: { flexDirection: 'row', gap: 5 },
  editBtn: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 8 },
  deleteBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#9CA3AF', marginTop: 10 },
  emptyCta: {
    marginTop: 14,
    backgroundColor: '#FF6B00',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emptyCtaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
});