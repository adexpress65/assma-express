// apps/mobile/app/super-admin/dashboard.tsx - VERSION CORRIGÉE
import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl,
  Alert,
  SafeAreaView
} from "react-native";
import { Ionicons, MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { 
  collection, 
  query, 
  where, 
  getDocs,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { db } from '@/config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import * as Application from 'expo-application';
import { LinearGradient } from 'expo-linear-gradient';

interface AdminStats {
  totalCompanies: number;
  pendingVerifications: number;
  totalProducts: number;
  totalOrders: number;
  totalUsers: number;
  activeToday: number;
  revenue: number;
  issues: number;
}

interface PendingCompany {
  id: string;
  name: string;
  email: string;
  createdAt: Timestamp;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  documents: any[];
}

interface RecentActivity {
  id: string;
  type: 'company_registration' | 'product_added' | 'order_placed' | 'support_ticket' | 'verification';
  title: string;
  description: string;
  createdAt: Timestamp;
  userEmail: string;
}

interface SystemStatus {
  firebase: 'online' | 'offline' | 'checking';
  database: 'operational' | 'degraded' | 'offline' | 'checking';
  security: 'active' | 'inactive' | 'error' | 'checking';
  lastSync: Date | null;
  appVersion: string;
}

export default function SuperAdminDashboard() {
  const router = useRouter();
  const { user, userRole } = useAuth();
  const [stats, setStats] = useState<AdminStats>({
    totalCompanies: 0,
    pendingVerifications: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalUsers: 0,
    activeToday: 0,
    revenue: 0,
    issues: 0
  });
  const [pendingCompanies, setPendingCompanies] = useState<PendingCompany[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    firebase: 'checking',
    database: 'checking',
    security: 'checking',
    lastSync: null,
    appVersion: '1.0.0'
  });
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Mettre à jour l'heure en temps réel
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000); // Mise à jour toutes les secondes

    // Récupérer la version de l'app
    const getAppVersion = async () => {
      try {
        const version = await Application.getNativeApplicationVersion();
        setSystemStatus(prev => ({ ...prev, appVersion: version || '1.0.0' }));
      } catch (error) {
        console.log('Erreur récupération version:', error);
      }
    };

    getAppVersion();

    return () => clearInterval(interval);
  }, []);

  // Vérifier l'état du système
  const checkSystemStatus = async () => {
    try {
      console.log('🔍 Vérification du statut système...');
      
      // Vérifier la connexion réseau avec expo-network
      const networkState = await Network.getNetworkStateAsync();
      const networkIsConnected = networkState.isConnected && networkState.isInternetReachable;
      setIsOnline(networkIsConnected);
      
      // Vérifier la base de données
      let dbStatus: 'operational' | 'degraded' | 'offline' | 'checking' = 'checking';
      try {
        await getDocs(query(collection(db, 'users'), limit(1)));
        dbStatus = 'operational';
      } catch (dbError) {
        console.log('Test DB échoué:', dbError);
        dbStatus = networkIsConnected ? 'degraded' : 'offline';
      }

      // Vérifier la sécurité (auth)
      let securityStatus: 'active' | 'inactive' | 'error' | 'checking' = 'checking';
      try {
        const app = getApp();
        securityStatus = app ? 'active' : 'inactive';
      } catch (authError) {
        securityStatus = 'error';
      }

      setSystemStatus(prev => ({
        ...prev,
        firebase: networkIsConnected ? 'online' : 'offline',
        database: dbStatus,
        security: securityStatus,
        lastSync: new Date()
      }));

      return networkIsConnected;
    } catch (error) {
      console.error('❌ Erreur vérification système:', error);
      setIsOnline(false);
      setSystemStatus(prev => ({
        ...prev,
        firebase: 'offline',
        database: 'offline',
        security: 'error'
      }));
      return false;
    }
  };

  // Charger les données du Super Admin
  const loadAdminData = async () => {
    if (!user || userRole !== 'super-admin') {
      Alert.alert('Accès refusé', 'Vous devez être Super Admin pour accéder à cette page');
      router.replace('/');
      return;
    }

    try {
      setLoading(true);
      
      // Vérifier le statut du système
      const systemIsOnline = await checkSystemStatus();
      
      if (!systemIsOnline) {
        await loadCachedData();
        Alert.alert(
          'Mode hors ligne',
          'Affichage des dernières données en cache. Veuillez vérifier votre connexion internet.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Charger les données depuis Firebase
      await Promise.all([
        loadStats(),
        loadPendingVerifications(),
        loadRecentActivities()
      ]);
      
    } catch (error: any) {
      console.error('❌ Erreur dashboard Super Admin:', error);
      
      if (error.code === 'unavailable' || error.message?.includes('network')) {
        await loadCachedData();
        Alert.alert(
          'Mode hors ligne',
          'Affichage des dernières données en cache',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Erreur', `Impossible de charger les données: ${error.message || 'Erreur inconnue'}`);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Charger depuis le cache
  const loadCachedData = async () => {
    try {
      const [cachedStats, cachedCompanies, cachedActivities] = await Promise.all([
        AsyncStorage.getItem('superAdminStats'),
        AsyncStorage.getItem('pendingCompanies'),
        AsyncStorage.getItem('recentActivities')
      ]);
      
      if (cachedStats) {
        setStats(JSON.parse(cachedStats));
      }
      if (cachedCompanies) {
        setPendingCompanies(JSON.parse(cachedCompanies));
      }
      if (cachedActivities) {
        setRecentActivities(JSON.parse(cachedActivities));
      }
    } catch (e) {
      console.error('Erreur chargement cache:', e);
    }
  };

  // Charger les statistiques DYNAMIQUEMENT depuis Firebase
  const loadStats = async () => {
    try {
      console.log('📊 Chargement des statistiques depuis Firebase...');
      
      // Récupérer toutes les données en parallèle
      const [
        companiesSnapshot,
        pendingSnapshot,
        productsSnapshot,
        ordersSnapshot,
        usersSnapshot,
        supportSnapshot
      ] = await Promise.all([
        getDocs(collection(db, 'companies')),
        getDocs(query(collection(db, 'companies'), where('verification.status', '==', 'pending'))),
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'orders')).catch(() => ({ size: 0, forEach: () => {} })),
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'supportTickets'), where('status', 'in', ['open', 'pending']))).catch(() => ({ size: 0 }))
      ]);

      // Calculer les utilisateurs actifs aujourd'hui
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const activeToday = usersSnapshot.docs.filter(doc => {
        const userData = doc.data();
        if (userData.lastLogin) {
          try {
            const lastLogin = userData.lastLogin.toDate ? userData.lastLogin.toDate() : new Date(userData.lastLogin);
            return lastLogin >= today;
          } catch {
            return false;
          }
        }
        return false;
      }).length;

      // Calculer le revenue total
      let totalRevenue = 0;
      if (ordersSnapshot.size > 0) {
        ordersSnapshot.forEach(doc => {
          const data = doc.data();
          totalRevenue += data.totalAmount || data.amount || 0;
        });
      }

      const statsData: AdminStats = {
        totalCompanies: companiesSnapshot.size,
        pendingVerifications: pendingSnapshot.size,
        totalProducts: productsSnapshot.size,
        totalOrders: ordersSnapshot.size,
        totalUsers: usersSnapshot.size,
        activeToday,
        revenue: totalRevenue,
        issues: supportSnapshot.size
      };

      setStats(statsData);
      console.log('✅ Statistiques chargées:', statsData);

      // Sauvegarder dans le cache
      await AsyncStorage.setItem('superAdminStats', JSON.stringify(statsData));
      
    } catch (error) {
      console.error('❌ Erreur chargement stats:', error);
      throw error;
    }
  };

  // Charger les vérifications en attente DYNAMIQUEMENT
  const loadPendingVerifications = async () => {
    try {
      console.log('📋 Chargement des vérifications en attente...');
      
      const pendingQuery = query(
        collection(db, 'companies'),
        where('verification.status', '==', 'pending'),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      
      const snapshot = await getDocs(pendingQuery);
      const companies: PendingCompany[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        companies.push({
          id: doc.id,
          name: data.name || data.companyName || 'Sans nom',
          email: data.email || data.ownerEmail || data.contactEmail || 'pas d\'email',
          createdAt: data.createdAt || Timestamp.now(),
          verificationStatus: data.verification?.status || 'pending',
          documents: data.documents || data.verificationDocuments || []
        });
      });
      
      setPendingCompanies(companies);
      console.log(`✅ ${companies.length} vérifications en attente chargées`);
      
      // Sauvegarder dans le cache
      await AsyncStorage.setItem('pendingCompanies', JSON.stringify(companies));
      
    } catch (error) {
      console.error('❌ Erreur chargement vérifications:', error);
      throw error;
    }
  };

  // Charger les activités récentes DYNAMIQUEMENT
  const loadRecentActivities = async () => {
    try {
      console.log('🔄 Chargement des activités récentes...');
      
      // Charger toutes les données en parallèle
      const [companiesSnapshot, productsSnapshot, ordersSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'companies'), orderBy('createdAt', 'desc'), limit(3))),
        getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(2))),
        getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(2))).catch(() => ({ docs: [] }))
      ]);
      
      const activities: RecentActivity[] = [];
      
      // Ajouter les entreprises récentes
      companiesSnapshot.forEach(doc => {
        const data = doc.data();
        activities.push({
          id: doc.id,
          type: 'company_registration',
          title: 'Nouvelle entreprise inscrite',
          description: `${data.name || data.companyName || 'Une entreprise'} s'est inscrite`,
          createdAt: data.createdAt || Timestamp.now(),
          userEmail: data.email || data.ownerEmail || 'Non spécifié'
        });
      });
      
      // Ajouter les produits récents
      productsSnapshot.forEach(doc => {
        const data = doc.data();
        activities.push({
          id: doc.id,
          type: 'product_added',
          title: 'Nouveau produit ajouté',
          description: `${data.name || 'Un produit'} ajouté par ${data.companyName || data.sellerName || 'un vendeur'}`,
          createdAt: data.createdAt || Timestamp.now(),
          userEmail: data.sellerEmail || data.companyEmail || 'Non spécifié'
        });
      });
      
      // Ajouter les commandes récentes
      ordersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        activities.push({
          id: doc.id,
          type: 'order_placed',
          title: 'Nouvelle commande',
          description: `Commande de ${(data.totalAmount || 0).toLocaleString()} XOF`,
          createdAt: data.createdAt || Timestamp.now(),
          userEmail: data.customerEmail || data.userEmail || 'Non spécifié'
        });
      });
      
      // Trier par date et limiter
      activities.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
      const limitedActivities = activities.slice(0, 5);
      
      setRecentActivities(limitedActivities);
      console.log(`✅ ${limitedActivities.length} activités chargées`);
      
      // Sauvegarder dans le cache
      await AsyncStorage.setItem('recentActivities', JSON.stringify(limitedActivities));
      
    } catch (error) {
      console.error('❌ Erreur chargement activités:', error);
      // Données par défaut en cas d'erreur
      const defaultActivities: RecentActivity[] = [
        {
          id: '1',
          type: 'company_registration',
          title: 'Nouvelle entreprise',
          description: 'Tech Solutions Inc. s\'est inscrite',
          createdAt: Timestamp.now(),
          userEmail: 'contact@techsolutions.com'
        },
        {
          id: '2',
          type: 'product_added',
          title: 'Nouveau produit',
          description: '50 produits ajoutés par EcoMarket',
          createdAt: Timestamp.fromDate(new Date(Date.now() - 3600000)),
          userEmail: 'vendor@ecomarket.com'
        }
      ];
      setRecentActivities(defaultActivities);
      await AsyncStorage.setItem('recentActivities', JSON.stringify(defaultActivities));
    }
  };

  // Menu principal
  const adminMenuItems = [
    { 
      label: "Vérifications", 
      icon: "shield-checkmark", 
      href: "/super-admin/verifications",
      count: stats.pendingVerifications,
      color: "#FF6B00"
    },
    { 
label: "Entreprises", 
      icon: "business", 
      // Changement ici : on pointe vers le dossier réel 'suppliers'
      href: "/super-admin/companies/add", 
      count: stats.totalCompanies,
      color: "#4CAF50"
    },
    { 
      label: "Produits", 
      icon: "cube", 
      href: "/super-admin/products",
      count: stats.totalProducts,
      color: "#2196F3"
    },
    { 
      label: "Commandes", 
      icon: "cart", 
      href: "/super-admin/orders",
      count: stats.totalOrders,
      color: "#9C27B0"
    },
    { 
      label: "Ajouter Produit", 
      icon: "add-circle", 
      href: "/super-admin/add-product",
      color: "#FF4081",
      isAction: true
    },
    { 
      label: "Utilisateurs", 
      icon: "people", 
      href: "/super-admin/users",
      count: stats.totalUsers,
      color: "#795548"
    },
    { 
      label: "Support", 
      icon: "headset", 
      href: "/super-admin/support",
      count: stats.issues,
      color: "#F44336"
    },
    { 
      label: "Analytiques", 
      icon: "stats-chart", 
      href: "/super-admin/analytics",
      color: "#FF9800"
    },
    { 
      label: "Paramètres", 
      icon: "settings", 
      href: "/super-admin/settings",
      color: "#607D8B"
    },
	{ 
    label: "Import Alibaba", 
    icon: "cloud-download", // Icone de téléchargement
    href: "/super-admin/import-alibaba", // On va créer cette page
    color: "#FF6600", // Couleur officielle Alibaba
    isAction: true 
  },
  ];

  useEffect(() => {
    if (user) {
      loadAdminData();
    }
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAdminData();
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'company_registration': return 'business';
      case 'product_added': return 'cube';
      case 'order_placed': return 'cart';
      case 'support_ticket': return 'help-circle';
      case 'verification': return 'shield-checkmark';
      default: return 'notifications';
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'company_registration': return '#4CAF50';
      case 'product_added': return '#2196F3';
      case 'order_placed': return '#FF9800';
      case 'support_ticket': return '#F44336';
      case 'verification': return '#9C27B0';
      default: return '#666';
    }
  };

  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate();
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      
      if (diffMins < 60) {
        return `il y a ${diffMins} min`;
      } else if (diffHours < 24) {
        return `il y a ${diffHours} h`;
      } else {
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      }
    } catch {
      return '';
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'online' || status === 'operational' || status === 'active') {
      return '#4CAF50';
    } else if (status === 'checking' || status === 'degraded') {
      return '#FF9800';
    } else {
      return '#F44336';
    }
  };

  const getStatusText = (status: string, type: 'firebase' | 'database' | 'security') => {
    const statusMap = {
      firebase: {
        online: 'Connecté',
        offline: 'Hors ligne',
        checking: 'Vérification...'
      },
      database: {
        operational: 'Opérationnel',
        degraded: 'Dégradé',
        offline: 'Hors ligne',
        checking: 'Vérification...'
      },
      security: {
        active: 'Actif',
        inactive: 'Inactif',
        error: 'Erreur',
        checking: 'Vérification...'
      }
    };
    
    return statusMap[type][status as keyof typeof statusMap[type]] || status;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={styles.loadingText}>Chargement du dashboard Super Admin...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            enabled={isOnline}
            colors={['#FF6B00']}
            tintColor="#FF6B00"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* En-tête */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>Super Admin</Text>
              <Text style={styles.welcome}>Bienvenue, {user?.displayName || user?.email || 'Admin'}</Text>
            </View>
            
            <View style={styles.headerRight}>
              {!isOnline && (
                <View style={styles.offlineBadge}>
                  <Ionicons name="cloud-offline" size={14} color="#FFF" />
                  <Text style={styles.offlineText}>Hors ligne</Text>
                </View>
              )}
              <TouchableOpacity 
                style={styles.notificationButton}
                onPress={() => router.push('/super-admin/notifications')}
              >
                <Ionicons name="notifications-outline" size={24} color="#333" />
                {stats.issues > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationCount}>
                      {stats.issues > 9 ? '9+' : stats.issues}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.headerBottom}>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('fr-FR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </Text>
            <Text style={styles.time}>{currentTime}</Text>
          </View>
        </View>

        {/* Statistiques */}
        <View style={styles.statsSection}>
          <View style={styles.statsGrid}>
            <TouchableOpacity style={styles.statCard} onPress={() => router.push('/super-admin/companies')}>
              <View style={[styles.statIcon, { backgroundColor: '#FF6B0020' }]}>
                <Ionicons name="business" size={24} color="#FF6B00" />
              </View>
              <Text style={styles.statValue}>{stats.totalCompanies}</Text>
              <Text style={styles.statLabel}>Entreprises</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.statCard} onPress={() => router.push('/super-admin/verifications')}>
              <View style={[styles.statIcon, { backgroundColor: '#4CAF5020' }]}>
                <Ionicons name="shield-checkmark" size={24} color="#4CAF50" />
              </View>
              <Text style={styles.statValue}>{stats.pendingVerifications}</Text>
              <Text style={styles.statLabel}>En attente</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.statCard} onPress={() => router.push('/super-admin/analytics')}>
              <View style={[styles.statIcon, { backgroundColor: '#2196F320' }]}>
                <MaterialIcons name="attach-money" size={24} color="#2196F3" />
              </View>
              <Text style={styles.statValue}>
                {stats.revenue > 1000000 
                  ? `${(stats.revenue / 1000000).toFixed(1)}M`
                  : stats.revenue > 1000 
                    ? `${(stats.revenue / 1000).toFixed(0)}K` 
                    : stats.revenue.toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>Revenus (XOF)</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.statCard} onPress={() => router.push('/super-admin/users')}>
              <View style={[styles.statIcon, { backgroundColor: '#9C27B020' }]}>
                <Ionicons name="people" size={24} color="#9C27B0" />
              </View>
              <Text style={styles.statValue}>{stats.totalUsers}</Text>
              <Text style={styles.statLabel}>Utilisateurs</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu principal */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Administration</Text>
          <View style={styles.menuGrid}>
            {adminMenuItems.map((item, index) => (
              <TouchableOpacity 
                key={item.label}
                style={[
                  styles.menuItem,
                  item.isAction && styles.menuItemAction
                ]}
                onPress={() => router.push(item.href as any)}
              >
                <View style={styles.menuItemTop}>
                  <View style={[
                    styles.menuIcon, 
                    { backgroundColor: `${item.color}20` },
                    item.isAction && styles.menuIconAction
                  ]}>
                    <Ionicons 
                      name={item.icon as any} 
                      size={item.isAction ? 24 : 22} 
                      color={item.color} 
                    />
                  </View>
                  {item.count !== undefined && item.count > 0 && !item.isAction && (
                    <View style={styles.menuBadge}>
                      <Text style={styles.menuBadgeText}>
                        {item.count > 9 ? '9+' : item.count}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[
                  styles.menuLabel,
                  item.isAction && styles.menuLabelAction
                ]} numberOfLines={2}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Bouton d'action rapide - AJOUT DE PRODUIT */}
        <View style={styles.quickActionSection}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.quickActionCard}
          >
            <View style={styles.quickActionContent}>
              <View style={styles.quickActionIcon}>
                <Ionicons name="add-circle" size={32} color="#FFF" />
              </View>
              <View style={styles.quickActionText}>
                <Text style={styles.quickActionTitle}>Ajouter un produit</Text>
                <Text style={styles.quickActionDescription}>
                  Créez un nouveau produit directement depuis le dashboard
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.quickActionButton}
              onPress={() => router.push('/super-admin/add-product')}
            >
              <Text style={styles.quickActionButtonText}>Commencer</Text>
              <Ionicons name="arrow-forward" size={16} color="#764ba2" />
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* Entreprises en attente */}
        {pendingCompanies.length > 0 && (
          <View style={styles.pendingSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Vérifications en attente</Text>
              <TouchableOpacity onPress={() => router.push('/super-admin/verifications')}>
                <Text style={styles.seeAllText}>Tout voir →</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.pendingScroll}
              contentContainerStyle={styles.pendingScrollContent}
            >
              {pendingCompanies.map((company) => (
                <TouchableOpacity 
                  key={company.id}
                  style={styles.pendingCard}
                  onPress={() => router.push(`/super-admin/verifications/${company.id}`)}
                >
                  <View style={styles.pendingCardHeader}>
                    <View style={styles.companyInitial}>
                      <Text style={styles.initialText}>
                        {company.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>EN ATTENTE</Text>
                    </View>
                  </View>
                  
                  <Text style={styles.companyName} numberOfLines={1}>
                    {company.name}
                  </Text>
                  <Text style={styles.companyEmail} numberOfLines={1}>
                    {company.email}
                  </Text>
                  
                  <View style={styles.pendingCardFooter}>
                    <Text style={styles.pendingDate}>
                      {formatDate(company.createdAt)}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#999" />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Activités récentes */}
        <View style={styles.activitySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Activité récente</Text>
            <TouchableOpacity onPress={() => router.push('/super-admin/activities')}>
              <Text style={styles.seeAllText}>Historique →</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.activityList}>
            {recentActivities.length > 0 ? (
              recentActivities.map((activity) => (
                <View key={activity.id} style={styles.activityItem}>
                  <View style={styles.activityLeft}>
                    <View style={[
                      styles.activityIcon, 
                      { backgroundColor: `${getActivityColor(activity.type)}20` }
                    ]}>
                      <Ionicons 
                        name={getActivityIcon(activity.type) as any} 
                        size={18} 
                        color={getActivityColor(activity.type)} 
                      />
                    </View>
                    <View style={styles.activityContent}>
                      <Text style={styles.activityTitle}>{activity.title}</Text>
                      <Text style={styles.activityDescription} numberOfLines={1}>
                        {activity.description}
                      </Text>
                      <Text style={styles.activityUser} numberOfLines={1}>
                        {activity.userEmail}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.activityTime}>
                    {formatDate(activity.createdAt)}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.noActivity}>
                <Ionicons name="time-outline" size={32} color="#CCC" />
                <Text style={styles.noActivityText}>Aucune activité récente</Text>
              </View>
            )}
          </View>
        </View>

        {/* Section système */}
        <View style={styles.systemSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>État du système</Text>
            <View style={styles.systemHeaderRight}>
              <Text style={styles.versionBadge}>v{systemStatus.appVersion}</Text>
              {systemStatus.lastSync && (
                <Text style={styles.lastSyncText}>
                  Sync: {systemStatus.lastSync.toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              )}
            </View>
          </View>
          
          <View style={styles.systemGrid}>
            <View style={styles.systemCard}>
              <View style={[
                styles.systemIconContainer,
                { backgroundColor: `${getStatusColor(systemStatus.firebase)}20` }
              ]}>
                <Ionicons 
                  name={systemStatus.firebase === 'online' ? 'cloud' : 'cloud-offline'} 
                  size={24} 
                  color={getStatusColor(systemStatus.firebase)} 
                />
              </View>
              <Text style={styles.systemTitle}>Firebase</Text>
              <Text style={[
                styles.systemStatus,
                { color: getStatusColor(systemStatus.firebase) }
              ]}>
                {getStatusText(systemStatus.firebase, 'firebase')}
              </Text>
            </View>
            
            <View style={styles.systemCard}>
              <View style={[
                styles.systemIconContainer,
                { backgroundColor: `${getStatusColor(systemStatus.database)}20` }
              ]}>
                <FontAwesome5 
                  name="database" 
                  size={22} 
                  color={getStatusColor(systemStatus.database)} 
                />
              </View>
              <Text style={styles.systemTitle}>Base de données</Text>
              <Text style={[
                styles.systemStatus,
                { color: getStatusColor(systemStatus.database) }
              ]}>
                {getStatusText(systemStatus.database, 'database')}
              </Text>
            </View>
            
            <View style={styles.systemCard}>
              <View style={[
                styles.systemIconContainer,
                { backgroundColor: `${getStatusColor(systemStatus.security)}20` }
              ]}>
                <Ionicons 
                  name={systemStatus.security === 'active' ? 'shield-checkmark' : 'shield'} 
                  size={24} 
                  color={getStatusColor(systemStatus.security)} 
                />
              </View>
              <Text style={styles.systemTitle}>Sécurité</Text>
              <Text style={[
                styles.systemStatus,
                { color: getStatusColor(systemStatus.security) }
              ]}>
                {getStatusText(systemStatus.security, 'security')}
              </Text>
            </View>
            
            <View style={styles.systemCard}>
              <View style={[styles.systemIconContainer, { backgroundColor: '#FF980020' }]}>
                <Ionicons name="sync" size={24} color="#FF9800" />
              </View>
              <Text style={styles.systemTitle}>Dernier refresh</Text>
              <Text style={[styles.systemStatus, { color: '#FF9800' }]}>
                {formatDate(Timestamp.now())}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#F8F9FA" 
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
  },
  header: {
    backgroundColor: '#FFF',
    padding: 20,
    paddingTop: 40,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  welcome: {
    fontSize: 14,
    color: '#666',
    maxWidth: 200,
  },
  date: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  time: {
    fontSize: 14,
    color: '#FF6B00',
    fontWeight: '600',
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F44336',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  offlineText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  notificationButton: {
    position: 'relative',
    padding: 4,
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#F44336',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationCount: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  statsSection: {
    padding: 16,
    paddingTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
  },
  menuSection: {
    padding: 16,
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  systemHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seeAllText: {
    color: '#FF6B00',
    fontSize: 14,
    fontWeight: '600',
  },
  lastSyncText: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  versionBadge: {
    fontSize: 11,
    color: '#2196F3',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '600',
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  menuItem: {
    width: '23%',
    alignItems: 'center',
    marginBottom: 16,
  },
  menuItemAction: {
    borderWidth: 2,
    borderColor: '#FF4081',
    backgroundColor: '#FF4081',
    borderRadius: 12,
    padding: 12,
    width: '48%', // Plus large pour "Ajouter Produit"
  },
  menuItemTop: {
    position: 'relative',
    marginBottom: 8,
  },
  menuIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIconAction: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#FF4081',
  },
  menuBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#F44336',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  menuBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  menuLabel: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 14,
  },
  menuLabelAction: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
    marginTop: 4,
  },
  quickActionSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
  },
  quickActionCard: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  quickActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  quickActionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  quickActionText: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  quickActionDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 18,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    gap: 8,
  },
  quickActionButtonText: {
    color: '#764ba2',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pendingSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
  },
  pendingScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  pendingScrollContent: {
    gap: 12,
    paddingRight: 16,
  },
  pendingCard: {
    width: 200,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#FFE5CC',
  },
  pendingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  companyInitial: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  pendingBadge: {
    backgroundColor: '#FFF3E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pendingBadgeText: {
    color: '#FF6B00',
    fontSize: 10,
    fontWeight: 'bold',
  },
  companyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  companyEmail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  pendingCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pendingDate: {
    fontSize: 11,
    color: '#999',
  },
  activitySection: {
    padding: 16,
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
    marginBottom: 16,
  },
  activityList: {
    gap: 12,
    minHeight: 100,
  },
  activityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  activityDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  activityUser: {
    fontSize: 11,
    color: '#999',
  },
  activityTime: {
    fontSize: 11,
    color: '#999',
    marginLeft: 8,
    minWidth: 60,
    textAlign: 'right',
  },
  noActivity: {
    alignItems: 'center',
    padding: 20,
  },
  noActivityText: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
  },
  systemSection: {
    padding: 16,
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  systemGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  systemCard: {
    width: '48%',
    alignItems: 'center',
  },
  systemIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  systemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  systemStatus: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 80,
  },
});
