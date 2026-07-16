// app/suppliers/index.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, FlatList, 
  TouchableOpacity, ScrollView, TextInput, Alert, KeyboardAvoidingView,
  Platform, Keyboard, TouchableWithoutFeedback
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  collection,
  getDocs,
  query,
  where,
  limit,
  getCountFromServer,
} from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../../src/config/firebase';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTranslation } from 'react-i18next';

interface Supplier {
  id: string;
  name?: string;
  email?: string;
  isActive?: boolean;
  stats?: {
    productCount?: number;
  };
}


type TabType = 'public' | 'supplier';

export default function SuppliersScreen() {
  const router = useRouter();
  const { user, userRole } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('public');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  
  // États pour la connexion
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Visible pour invités (connexion fournisseur) et comptes ayant un rôle fournisseur.
  const canAccessSupplierSpace =
    !user || userRole === 'seller' || userRole === 'admin' || userRole === 'super-admin';

  useEffect(() => {
    if (!canAccessSupplierSpace && activeTab === 'supplier') {
      setActiveTab('public');
    }
  }, [activeTab, canAccessSupplierSpace]);

  useEffect(() => {
const loadSuppliers = async () => {
  try {
    setLoading(true);
    /**
     * Avant : `getDocs` sur **tous** les produits par entreprise → lecture énorme (minutes si gros catalogue).
     * Maintenant : `getCountFromServer` (agrégat) + plafond d’entreprises listées.
     */
    const MAX_SUPPLIERS_LIST = 80;
    const q = query(
      collection(db, 'companies'),
      where('isActive', '==', true),
      limit(MAX_SUPPLIERS_LIST),
    );
    const snapshot = await getDocs(q);

    const list = await Promise.all(
      snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        const fromStats =
          typeof data.stats?.productCount === 'number' ? data.stats.productCount : null;

        let realCount = fromStats ?? 0;
        if (fromStats == null) {
          try {
            const byCompany = query(
              collection(db, 'products'),
              where('companyId', '==', docSnap.id),
            );
            const c1 = await getCountFromServer(byCompany);
            realCount = c1.data().count;
            if (realCount === 0) {
              const bySupplier = query(
                collection(db, 'products'),
                where('supplierId', '==', docSnap.id),
              );
              const c2 = await getCountFromServer(bySupplier);
              realCount = c2.data().count;
            }
          } catch {
            realCount = 0;
          }
        }

        return {
          id: docSnap.id,
          ...data,
          stats: {
            ...data.stats,
            productCount: realCount,
          },
        } as Supplier;
      }),
    );

    setSuppliers(list);
  } catch (error) {
    console.error('Erreur chargement réels :', error);
  } finally {
    setLoading(false);
  }
};

    if (activeTab === 'public') {
      loadSuppliers();
    }
  }, [activeTab]);

  const handleSupplierLogin = async () => {
    if (!loginEmail || !loginPassword) {
      Alert.alert(t('app.account.errorTitle'), t('app.account.loginFieldsError'));
      return;
    }

    setLoginLoading(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const user = auth.currentUser;
      if (user) {
        // ✅ Redirection vers le dashboard après connexion
        router.replace('/suppliers/dashboard');
      }
    } catch (error: any) {
      console.error('Erreur connexion:', error);
      let errorMessage = 'Erreur de connexion';
      switch (error.code) {
        case 'auth/user-not-found': errorMessage = t('app.supplier.index.authUserNotFound'); break;
        case 'auth/wrong-password': errorMessage = t('app.supplier.index.authWrongPassword'); break;
        case 'auth/invalid-email': errorMessage = t('app.supplier.index.authInvalidEmail'); break;
        case 'auth/too-many-requests': errorMessage = t('app.supplier.index.authTooManyRequests'); break;
      }
      Alert.alert(t('app.account.errorTitle'), errorMessage);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegisterSupplier = () => {
    router.push('/suppliers/register');
  };

  const handleEditProfile = () => {
    // ✅ Redirection vers le formulaire de modification avec l'ID du fournisseur connecté
    const user = auth.currentUser;
    if (user) {
      router.push(`/suppliers/register?id=${user.uid}`);
    } else {
      Alert.alert(t('app.account.errorTitle'), t('app.supplier.index.editProfileRequiresLogin'));
    }
  };

  return (
    <View style={styles.container}>
      {/* En-tête avec onglets */}
      <LinearGradient colors={['#FF6B00', '#FF8C00']} style={styles.header}>
        <Text style={styles.mainTitle}>{t('common.suppliers')}</Text>
        {canAccessSupplierSpace && (
          <View style={styles.accessBadge}>
            <Ionicons name="shield-checkmark-outline" size={14} color="#065F46" />
            <Text style={styles.accessBadgeText}>{t('app.supplier.index.supplierAccessBadge')}</Text>
          </View>
        )}
        
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'public' && styles.activeTab]}
            onPress={() => setActiveTab('public')}
          >
            <Ionicons name="people" size={20} color={activeTab === 'public' ? '#FF6B00' : '#fff'} />
            <Text style={[styles.tabText, activeTab === 'public' && styles.activeTabText]}>{t('app.supplier.index.publicListTab')}</Text>
          </TouchableOpacity>
          
          {canAccessSupplierSpace && (
            <TouchableOpacity
              style={[styles.tab, activeTab === 'supplier' && styles.activeTab]}
              onPress={() => setActiveTab('supplier')}
            >
              <Ionicons name="business" size={20} color={activeTab === 'supplier' ? '#FF6B00' : '#fff'} />
              <Text style={[styles.tabText, activeTab === 'supplier' && styles.activeTabText]}>{t('app.supplier.index.proSpaceTab')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* CONTENU : LISTE PUBLIQUE */}
      {activeTab === 'public' && (
        <View style={styles.tabContent}>
          <Text style={styles.tabTitle}>{t('app.supplier.index.ourSuppliersCount', { count: suppliers.length })}</Text>
          {loading ? (
            <View style={styles.center}><ActivityIndicator size="large" color="#FF6B00" /></View>
          ) : (
            <FlatList
              data={suppliers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.companyLogo}>
                      <Text style={styles.logoText}>{item.name?.charAt(0).toUpperCase() || 'F'}</Text>
                    </View>
                    <View style={styles.companyInfo}>
                      <Text style={styles.name}>{item.name || t('app.supplier.index.missingName')}</Text>
                      <Text style={styles.email}>{item.email || t('app.supplier.index.missingEmail')}</Text>
                    </View>
                  </View>
                  <View style={styles.cardStats}>
                    <View style={styles.statItem}>
                      <Ionicons name="cube-outline" size={16} color="#FF6B00" />
                      <Text style={styles.count}>{t('app.supplier.index.productsCount', { count: item.stats?.productCount ?? 0 })}</Text>
                    </View>
                    <View style={[styles.statusBadge, item.isActive ? styles.statusActive : styles.statusInactive]}>
                      <Ionicons name={item.isActive ? "checkmark-circle" : "close-circle"} size={12} color="#fff" />
                      <Text style={styles.statusText}>{item.isActive ? t('app.supplier.index.active') : t('app.supplier.index.inactive')}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.viewButton}
                    onPress={() =>
                      router.push({
                        pathname: '/company/[id]',
                        params: { id: item.id, view: 'dashboard' },
                      })
                    }
                  >
                    <Text style={styles.viewButtonText}>{t('app.supplier.index.viewStore')}</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
              contentContainerStyle={styles.list}
            />
          )}
        </View>
      )}

      {/* CONTENU : ESPACE PRO */}
      {activeTab === 'supplier' && canAccessSupplierSpace && (
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView contentContainerStyle={styles.loginContainer}>
              <View style={styles.loginHeader}>
                <View style={styles.loginIcon}>
                  <Ionicons name="business" size={48} color="#FF6B00" />
                </View>
                <Text style={styles.loginTitle}>{t('app.supplier.index.supplierSpaceTitle')}</Text>
                <Text style={styles.loginSubtitle}>
                  {t('app.supplier.index.supplierSpaceSubtitle')}
                </Text>
                <View style={styles.proPillsRow}>
                  <View style={styles.proPill}>
                    <Ionicons name="shield-checkmark-outline" size={14} color="#065F46" />
                    <Text style={styles.proPillText}>{t('app.supplier.index.secureAccess')}</Text>
                  </View>
                  <View style={styles.proPill}>
                    <Ionicons name="speedometer-outline" size={14} color="#1D4ED8" />
                    <Text style={styles.proPillText}>{t('app.supplier.index.proDashboard')}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.formContainer}>
                <View style={styles.infoCard}>
                  <Ionicons name="information-circle-outline" size={18} color="#1D4ED8" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoCardTitle}>{t('app.supplier.index.supplierLoginTitle')}</Text>
                    <Text style={styles.infoCardText}>
                      {t('app.supplier.index.useMainAccountCredentials')}
                    </Text>
                  </View>
                </View>

                <Text style={styles.formLabel}>{t('app.supplier.index.businessEmailLabel')}</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={t('app.supplier.index.businessEmailPlaceholder')}
                    value={loginEmail}
                    onChangeText={setLoginEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <Text style={styles.formLabel}>{t('app.supplier.index.passwordLabel')}</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={t('app.supplier.index.passwordPlaceholder')}
                    value={loginPassword}
                    onChangeText={setLoginPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((prev) => !prev)}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? t('app.supplier.index.hidePasswordA11y') : t('app.supplier.index.showPasswordA11y')}
                  >
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#666" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.passwordHint}>
                  {t('app.supplier.index.useMainAccountPasswordHint')}
                </Text>

                <TouchableOpacity 
                  style={[styles.loginButton, loginLoading && styles.loginButtonDisabled]} 
                  onPress={handleSupplierLogin} 
                  disabled={loginLoading}
                >
                  {loginLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.loginButtonText}>{t('app.messages.signIn')}</Text>
                      <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </>
                  )}
                </TouchableOpacity>

                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>{t('app.supplier.index.or')}</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity 
                  style={styles.registerButton} 
                  onPress={handleRegisterSupplier}
                >
                  <Ionicons name="person-add-outline" size={20} color="#FF6B00" />
                  <Text style={styles.registerButtonText}>{t('app.supplier.index.createSupplierAccount')}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.editProfileButton} 
                  onPress={handleEditProfile}
                >
                  <Ionicons name="create-outline" size={20} color="#FF6B00" />
                  <Text style={styles.editProfileButtonText}>{t('app.supplier.index.editMyProfile')}</Text>
                </TouchableOpacity>

                {user && (userRole === 'seller' || userRole === 'admin' || userRole === 'super-admin') && (
                  <TouchableOpacity
                    style={styles.dashboardQuickButton}
                    onPress={() => router.push('/suppliers/dashboard')}
                  >
                    <Ionicons name="grid-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.dashboardQuickText}>{t('app.supplier.index.goToDashboard')}</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.featuresContainer}>
                  <Text style={styles.featuresTitle}>{t('app.supplier.index.supplierSpaceFeaturesTitle')}</Text>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <Text style={styles.featureText}>{t('app.supplier.index.featureManageProducts')}</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <Text style={styles.featureText}>{t('app.supplier.index.featureTrackOrders')}</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <Text style={styles.featureText}>{t('app.supplier.index.featureEditCompany')}</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <Text style={styles.featureText}>{t('app.supplier.index.featureAccessRequests')}</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  accessBadge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D1FAE5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
  },
  accessBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  activeTab: {
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  activeTabText: {
    color: '#FF6B00',
  },
  tabContent: {
    flex: 1,
  },
  tabTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    margin: 16,
    marginBottom: 12,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  companyLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B00',
  },
  companyInfo: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  cardStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  count: {
    fontSize: 14,
    color: '#FF6B00',
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  statusActive: {
    backgroundColor: '#10B981',
  },
  statusInactive: {
    backgroundColor: '#EF4444',
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  viewButton: {
    flexDirection: 'row',
    backgroundColor: '#FF6B00',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  viewButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  loginContainer: {
    padding: 24,
  },
  loginHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  loginIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  loginSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  proPillsRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  proPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  proPillText: {
    fontSize: 12,
    color: '#1E3A8A',
    fontWeight: '600',
  },
  formContainer: {
    marginBottom: 32,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    marginBottom: 8,
  },
  infoCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E3A8A',
    marginBottom: 2,
  },
  infoCardText: {
    fontSize: 12,
    color: '#1F2937',
    lineHeight: 17,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
    marginTop: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1A1A1A',
  },
  passwordHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#6B7280',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 12,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#FF6B00',
    fontWeight: '500',
  },
  loginButton: {
    flexDirection: 'row',
    backgroundColor: '#FF6B00',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 8,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#9CA3AF',
  },
  registerButton: {
    flexDirection: 'row',
    backgroundColor: '#FFF3E0',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  registerButtonText: {
    color: '#FF6B00',
    fontSize: 16,
    fontWeight: '600',
  },
  // ✅ NOUVEAU STYLE POUR LE BOUTON DE MODIFICATION
  editProfileButton: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: '#FF6B00',
    borderStyle: 'dashed',
  },
  editProfileButtonText: {
    color: '#FF6B00',
    fontSize: 16,
    fontWeight: '600',
  },
  dashboardQuickButton: {
    marginTop: 12,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dashboardQuickText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  featuresContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 24,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#4B5563',
    flex: 1,
  },
});
