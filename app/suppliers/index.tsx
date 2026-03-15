// app/suppliers/index.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, FlatList, 
  TouchableOpacity, ScrollView, TextInput, Alert, KeyboardAvoidingView,
  Platform, Keyboard, TouchableWithoutFeedback
} from 'react-native';
import { useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore'; 
import { signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../../src/config/firebase';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

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
  const [activeTab, setActiveTab] = useState<TabType>('public');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  
  // États pour la connexion
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
const loadSuppliers = async () => {
  try {
    setLoading(true);
    // 1. Récupérer les entreprises actives
    const q = query(collection(db, 'companies'), where('isActive', '==', true));
    const snapshot = await getDocs(q);
    
    // 2. Pour chaque entreprise, compter ses produits
    const list = await Promise.all(snapshot.docs.map(async (doc) => {
      const data = doc.data();
      
      // On cherche les produits qui appartiennent à ce fournisseur
      // IMPORTANT : Vérifie si ton champ s'appelle 'supplierId' ou 'uid' dans la collection 'products'
      const productsQuery = query(
        collection(db, 'products'), 
        where('supplierId', '==', doc.id) 
      );
      
      const productsSnapshot = await getDocs(productsQuery);
      const realCount = productsSnapshot.size; // Récupère le nombre réel de documents trouvés

      return {
        id: doc.id,
        ...data,
        stats: {
          ...data.stats,
          productCount: realCount // On remplace le 0 ou le 2 par le vrai chiffre
        }
      } as Supplier;
    }));

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
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
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
        case 'auth/user-not-found': errorMessage = 'Aucun compte trouvé avec cet email'; break;
        case 'auth/wrong-password': errorMessage = 'Mot de passe incorrect'; break;
        case 'auth/invalid-email': errorMessage = 'Email invalide'; break;
        case 'auth/too-many-requests': errorMessage = 'Trop de tentatives. Réessayez plus tard'; break;
      }
      Alert.alert('Erreur', errorMessage);
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
      Alert.alert('Erreur', 'Vous devez être connecté pour modifier votre profil');
    }
  };

  return (
    <View style={styles.container}>
      {/* En-tête avec onglets */}
      <LinearGradient colors={['#FF6B00', '#FF8C00']} style={styles.header}>
        <Text style={styles.mainTitle}>Fournisseurs</Text>
        
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'public' && styles.activeTab]}
            onPress={() => setActiveTab('public')}
          >
            <Ionicons name="people" size={20} color={activeTab === 'public' ? '#FF6B00' : '#fff'} />
            <Text style={[styles.tabText, activeTab === 'public' && styles.activeTabText]}>Liste publique</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'supplier' && styles.activeTab]}
            onPress={() => setActiveTab('supplier')}
          >
            <Ionicons name="business" size={20} color={activeTab === 'supplier' ? '#FF6B00' : '#fff'} />
            <Text style={[styles.tabText, activeTab === 'supplier' && styles.activeTabText]}>Espace pro</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* CONTENU : LISTE PUBLIQUE */}
      {activeTab === 'public' && (
        <View style={styles.tabContent}>
          <Text style={styles.tabTitle}>Nos Fournisseurs ({suppliers.length})</Text>
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
                      <Text style={styles.name}>{item.name || 'Nom manquant'}</Text>
                      <Text style={styles.email}>{item.email || 'Email non renseigné'}</Text>
                    </View>
                  </View>
                  <View style={styles.cardStats}>
                    <View style={styles.statItem}>
                      <Ionicons name="cube-outline" size={16} color="#FF6B00" />
                      <Text style={styles.count}>{item.stats?.productCount ?? 0} produits</Text>
                    </View>
                    <View style={[styles.statusBadge, item.isActive ? styles.statusActive : styles.statusInactive]}>
                      <Ionicons name={item.isActive ? "checkmark-circle" : "close-circle"} size={12} color="#fff" />
                      <Text style={styles.statusText}>{item.isActive ? 'Actif' : 'Inactif'}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.viewButton} onPress={() => router.push(`/company/${item.id}`)}>
                    <Text style={styles.viewButtonText}>Voir la boutique</Text>
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
      {activeTab === 'supplier' && (
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
                <Text style={styles.loginTitle}>Espace Fournisseur</Text>
                <Text style={styles.loginSubtitle}>
                  Gérez votre entreprise, vos produits et vos commandes
                </Text>
              </View>

              <View style={styles.formContainer}>
                <Text style={styles.formLabel}>Email professionnel</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="contact@votre-entreprise.com"
                    value={loginEmail}
                    onChangeText={setLoginEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <Text style={styles.formLabel}>Mot de passe</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Votre mot de passe"
                    value={loginPassword}
                    onChangeText={setLoginPassword}
                    secureTextEntry
                  />
                </View>

                <TouchableOpacity 
                  style={[styles.loginButton, loginLoading && styles.loginButtonDisabled]} 
                  onPress={handleSupplierLogin} 
                  disabled={loginLoading}
                >
                  {loginLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.loginButtonText}>Se connecter</Text>
                      <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </>
                  )}
                </TouchableOpacity>

                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>ou</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity 
                  style={styles.registerButton} 
                  onPress={handleRegisterSupplier}
                >
                  <Ionicons name="person-add-outline" size={20} color="#FF6B00" />
                  <Text style={styles.registerButtonText}>Créer un compte fournisseur</Text>
                </TouchableOpacity>

                {/* ✅ NOUVEAU : Bouton pour modifier le profil */}
                <TouchableOpacity 
                  style={styles.editProfileButton} 
                  onPress={handleEditProfile}
                >
                  <Ionicons name="create-outline" size={20} color="#FF6B00" />
                  <Text style={styles.editProfileButtonText}>Modifier mon profil</Text>
                </TouchableOpacity>

                <View style={styles.featuresContainer}>
                  <Text style={styles.featuresTitle}>Espace Fournisseur :</Text>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <Text style={styles.featureText}>Gérez vos produits en temps réel</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <Text style={styles.featureText}>Suivez vos commandes et statistiques</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <Text style={styles.featureText}>Modifiez votre profil d'entreprise</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <Text style={styles.featureText}>Accédez aux demandes des clients</Text>
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
    marginBottom: 20,
    textAlign: 'center',
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
  formContainer: {
    marginBottom: 32,
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
