// apps/mobile/app/seller/dashboard.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  SafeAreaView,
  Image,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from "@/contexts/AuthContext";
import {
  collection,
  query,
  where,
  getDocs,
  getCountFromServer,
  orderBy,
  limit,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from "@/config/firebase";

/** Stats vendeur : limite stricte pour accélérer le premier rendu. */
const ORDERS_STATS_LIMIT = 100;

interface Address {
  city: string;
  country: string;
  street: string;
  fullAddress?: string;
}

interface Stats {
  productCount: number;
  orderCount?: number;
  rating?: number;
  viewCount?: number;
}

interface CompanyData {
  // Informations de base
  name: string;
  nameLower?: string;
  name_lower?: string;
  uid: string;
  
  // Médias
  logo?: string;
  coverImage?: string;
  
  // Adresse
  address?: Address;
  city?: string;
  country?: string;
  street?: string;
  fullAddress?: string;
  location?: string;
  
  // Profil boutique / fournisseur
  type: string;
  businessType?: string;
  description?: string;
  email?: string;
  phone?: string;
  website?: string;
  yearEstablished?: number;
  employees?: string;
  employeeCount?: string;
  annualRevenue?: string;
  
  // Produits et catégories
  mainProducts?: string;
  categories?: string[];
  mainCategory?: string;
  
  // Badges et statuts
  verified?: boolean;
  goldSupplier?: boolean;
  isActive?: boolean;
  status?: string;
  
  // Statistiques
  stats?: Stats;
  rating?: number;
  responseRate?: number;
  productCount?: number;
  
  // Certifications
  certifications?: string[];
  
  // Dates
  updatedAt?: any;
}

interface DashboardStats {
  totalProducts: number;
  pendingOrders: number;
  totalRevenue: number;
  totalOrders: number;
  totalMessages: number;
  unreadMessages: number;
}

interface RecentOrder {
  id: string;
  customerName: string;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
  createdAt: any;
  items: any[];
}

interface RecentMessage {
  id: string;
  senderName: string;
  senderId: string;
  lastMessage: string;
  timestamp: any;
  unread: boolean;
  conversationId: string;
}

export default function SellerDashboard() {
  const { user } = useAuth();
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    pendingOrders: 0,
    totalRevenue: 0,
    totalOrders: 0,
    totalMessages: 0,
    unreadMessages: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);
  /** Bloque l’écran uniquement le temps de charger le profil (léger). */
  const [loading, setLoading] = useState(true);
  /** Stats / listes : chargées après, sans bloquer tout l’écran. */
  const [statsLoading, setStatsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      loadDashboardData(false);
    }
  }, [user]);

  const orderCreatedMs = (data: any): number => {
    const c = data?.createdAt;
    if (c && typeof c.toDate === "function") return c.toDate().getTime();
    return 0;
  };

  const loadDashboardData = async (fromPullRefresh = false) => {
    if (!user?.uid) return;

    try {
      if (!fromPullRefresh) {
        setLoading(true);
        setStatsLoading(true);
      }

      const companySnap = await getDoc(doc(db, "companies", user.uid));

      if (companySnap.exists()) {
        const data = companySnap.data();
        const companyData: CompanyData = {
          name: data.name || "Ma boutique",
          nameLower: data.nameLower,
          name_lower: data.name_lower,
          uid: data.uid || user.uid,
          logo: data.logo,
          coverImage: data.coverImage,
          address: data.address,
          city: data.city,
          country: data.country,
          street: data.street,
          fullAddress: data.fullAddress,
          location: data.location,
          type: data.type || "B2B",
          businessType: data.businessType,
          description: data.description || "Aucune description disponible",
          email: data.email,
          phone: data.phone,
          yearEstablished: data.yearEstablished,
          employees: data.employees,
          employeeCount: data.employeeCount,
          annualRevenue: data.annualRevenue,
          mainProducts: data.mainProducts || "Aucun produit spécifié",
          categories: data.categories || [],
          mainCategory: data.mainCategory,
          verified: data.verified || false,
          goldSupplier: data.goldSupplier || false,
          isActive: data.isActive || false,
          status: data.status || "active",
          stats: data.stats || { productCount: 0 },
          rating: data.rating || 0,
          responseRate: data.responseRate || 0,
          productCount: data.stats?.productCount || 0,
          certifications: data.certifications || [],
          updatedAt: data.updatedAt,
        };
        setCompany(companyData);
      } else {
        setCompany({
          name: "Ma Boutique",
          type: "B2B",
          description: "Bienvenue sur ma boutique",
          verified: false,
          goldSupplier: false,
          isActive: true,
          status: "active",
          stats: { productCount: 0 },
          rating: 0,
          responseRate: 0,
          productCount: 0,
          mainProducts: "Aucun produit spécifié",
          categories: [],
          certifications: [],
          uid: user.uid,
        });
      }
    } catch (error) {
      console.error("Erreur chargement profil fournisseur:", error);
      Alert.alert("Erreur", "Impossible de charger le profil fournisseur");
    } finally {
      setLoading(false);
    }

    try {
      const ordersRef = collection(db, "orders");
      const ordersQSellerId = query(
        ordersRef,
        where("sellerId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(ORDERS_STATS_LIMIT)
      );
      const ordersQSellerIds = query(
        ordersRef,
        where("sellerIds", "array-contains", user.uid),
        orderBy("createdAt", "desc"),
        limit(ORDERS_STATS_LIMIT)
      );
      const productsCountQuery = query(collection(db, "products"), where("sellerId", "==", user.uid));

      const [productsCountSnap, ordersSnapA, ordersSnapB, conversationsSnap] = await Promise.all([
        getCountFromServer(productsCountQuery),
        getDocs(ordersQSellerId),
        getDocs(ordersQSellerIds),
        getDocs(
          query(
            collection(db, "conversations"),
            where("participants", "array-contains", user.uid),
            orderBy("updatedAt", "desc"),
            limit(5)
          )
        ),
      ]);

      const totalProducts = productsCountSnap.data().count;
      let pendingOrders = 0;
      let totalRevenue = 0;
      let totalOrders = 0;

      const ordersDocs = new Map<string, any>();
      ordersSnapA.forEach((d) => ordersDocs.set(d.id, d.data()));
      ordersSnapB.forEach((d) => ordersDocs.set(d.id, d.data()));

      const mergedEntries = Array.from(ordersDocs.entries()).sort(
        (a, b) => orderCreatedMs(b[1]) - orderCreatedMs(a[1])
      );

      mergedEntries.forEach(([, order]) => {
        totalOrders++;
        const st = String(order.status || "").toLowerCase();
        if (st === "pending" || st === "pending_payment") pendingOrders++;
        if (st === "delivered" || st === "shipped") {
          totalRevenue += Number(order.totalAmount || order.total || 0);
        }
      });

      const recentSlice = mergedEntries.slice(0, 5).map(([id, data]) => ({
        id,
        customerName: data.userName || "Client",
        total: Number(data.totalAmount || data.total || 0),
        status: (data.status || "pending") as RecentOrder["status"],
        createdAt: data.createdAt,
        items: data.items || [],
      }));

      let unreadMessages = 0;
      const messages: RecentMessage[] = [];
      conversationsSnap.forEach((d) => {
        const conv = d.data();
        const otherParticipant = conv.participantDetails?.find((p: any) => p.id !== user.uid);
        messages.push({
          id: d.id,
          senderName: otherParticipant?.name || "Client",
          senderId: otherParticipant?.id || "",
          lastMessage: conv.lastMessage || "Nouveau message",
          timestamp: conv.lastMessageTimestamp,
          unread: conv.unreadCount?.[user.uid] > 0 || false,
          conversationId: d.id,
        });
        if (conv.unreadCount?.[user.uid] > 0) {
          unreadMessages += conv.unreadCount[user.uid];
        }
      });

      setRecentMessages(messages);
      setRecentOrders(recentSlice);
      setStats({
        totalProducts,
        pendingOrders,
        totalRevenue,
        totalOrders,
        totalMessages: conversationsSnap.size,
        unreadMessages,
      });
    } catch (error) {
      console.error("Erreur chargement stats dashboard:", error);
      if (!fromPullRefresh) {
        Alert.alert("Erreur", "Certaines statistiques n’ont pas pu être chargées");
      }
    } finally {
      setStatsLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData(true);
  };

  const formatPrice = (price: number) => {
    return `${price.toLocaleString()} XOF`;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      if (days === 0) {
        return "Aujourd'hui";
      } else if (days === 1) {
        return 'Hier';
      } else if (days < 7) {
        return `Il y a ${days} jours`;
      } else {
        return date.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      }
    } catch {
      return '';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'processing': return '#3B82F6';
      case 'shipped': return '#8B5CF6';
      case 'delivered': return '#10B981';
      default: return '#6B7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'En attente';
      case 'processing': return 'En cours';
      case 'shipped': return 'Expédiée';
      case 'delivered': return 'Livrée';
      default: return status;
    }
  };

  const getFullAddress = () => {
    if (company?.fullAddress) return company.fullAddress;
    if (company?.address) {
      const addr = company.address;
      return `${addr.street}, ${addr.city}, ${addr.country}`;
    }
    if (company?.city && company?.country) {
      return `${company.city}, ${company.country}`;
    }
    return 'Adresse non disponible';
  };

  const handleCall = () => {
    if (company?.phone) {
      Linking.openURL(`tel:${company.phone}`);
    } else {
      Alert.alert('Info', 'Numéro de téléphone non disponible');
    }
  };

  const handleEmail = () => {
    if (company?.email) {
      Linking.openURL(`mailto:${company.email}`);
    } else {
      Alert.alert('Info', 'Email non disponible');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Chargement de votre dashboard...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Image de couverture - redirige vers /suppliers/dashboard */}
        <TouchableOpacity 
          onPress={() => router.push('/suppliers/dashboard')}
          activeOpacity={0.9}
        >
          {company?.coverImage ? (
            <Image source={{ uri: company.coverImage }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="camera-outline" size={40} color="#CBD5E1" />
              <Text style={styles.coverPlaceholderText}>Ajouter une couverture</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Section profil boutique / fournisseur */}
        <TouchableOpacity 
          style={styles.profileSection}
          onPress={() => router.push('/suppliers/dashboard')}
          activeOpacity={0.7}
        >
          <View style={styles.profileHeader}>
            <View style={styles.logoContainer}>
              {company?.logo ? (
                <Image source={{ uri: company.logo }} style={styles.logo} />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Text style={styles.logoPlaceholderText}>
                    {company?.name?.charAt(0) || 'E'}
                  </Text>
                </View>
              )}
              <View style={styles.editBadge}>
                <Ionicons name="pencil" size={12} color="#FFFFFF" />
              </View>
            </View>
            
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>{company?.name || 'Ma Boutique'}</Text>
              
              <View style={styles.companyMeta}>
                {/* Localisation */}
                {(company?.city || company?.country) && (
                  <View style={styles.metaItem}>
                    <Ionicons name="location-outline" size={14} color="#6B7280" />
                    <Text style={styles.metaText}>
                      {company.city ? company.city : ''} 
                      {company.city && company.country ? ', ' : ''}
                      {company.country ? company.country : ''}
                    </Text>
                  </View>
                )}
                
                {/* Type d’activité */}
                {company?.type && (
                  <View style={styles.metaItem}>
                    <Ionicons name="business-outline" size={14} color="#6B7280" />
                    <Text style={styles.metaText}>{company.type}</Text>
                  </View>
                )}

                {/* Année d'établissement */}
                {company?.yearEstablished && (
                  <View style={styles.metaItem}>
                    <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                    <Text style={styles.metaText}>Depuis {company.yearEstablished}</Text>
                  </View>
                )}
              </View>

              {/* Badges */}
              <View style={styles.badgesContainer}>
                {company?.verified && (
                  <View style={[styles.badge, styles.verifiedBadge]}>
                    <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                    <Text style={styles.badgeText}>Vérifié</Text>
                  </View>
                )}
                {company?.goldSupplier && (
                  <View style={[styles.badge, styles.goldBadge]}>
                    <Ionicons name="star" size={12} color="#F59E0B" />
                    <Text style={styles.badgeText}>Gold Supplier</Text>
                  </View>
                )}
                {company?.rating ? (
                  <View style={[styles.badge, styles.ratingBadge]}>
                    <Ionicons name="star" size={12} color="#F59E0B" />
                    <Text style={styles.badgeText}>{company.rating.toFixed(1)}</Text>
                  </View>
                ) : null}
                {company?.isActive && (
                  <View style={[styles.badge, styles.activeBadge]}>
                    <Ionicons name="flash" size={12} color="#3B82F6" />
                    <Text style={styles.badgeText}>Actif</Text>
                  </View>
                )}
              </View>
            </View>
            
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </View>

          {/* Description courte */}
          {company?.description && (
            <Text style={styles.description} numberOfLines={2}>
              {company.description}
            </Text>
          )}

          {/* Produits principaux */}
          {company?.mainProducts && (
            <View style={styles.mainProducts}>
              <Text style={styles.mainProductsTitle}>Produits principaux :</Text>
              <Text style={styles.mainProductsText}>
                {company.mainProducts}
              </Text>
            </View>
          )}

          {/* Contacts rapides */}
          {(company?.phone || company?.email) && (
            <View style={styles.contactQuick}>
              {company?.phone && (
                <TouchableOpacity onPress={handleCall} style={styles.contactQuickItem}>
                  <Ionicons name="call" size={16} color="#3B82F6" />
                </TouchableOpacity>
              )}
              {company?.email && (
                <TouchableOpacity onPress={handleEmail} style={styles.contactQuickItem}>
                  <Ionicons name="mail" size={16} color="#3B82F6" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </TouchableOpacity>

        {/* Statistiques clés */}
        <View style={styles.statsGrid}>
          {/* Carte Produits - NON cliquable, affiche le nombre exact */}
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="cube" size={24} color="#3B82F6" />
            </View>
            <Text style={styles.statValue}>
              {statsLoading ? "—" : stats.totalProducts || company?.productCount || 0}
            </Text>
            <Text style={styles.statLabel}>Produits</Text>
          </View>

          {/* Carte Commandes en attente - cliquable */}
          <TouchableOpacity 
            style={styles.statCard}
            onPress={() => router.push('/suppliers/orders?filter=pending')}
          >
            <View style={[styles.statIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="time" size={24} color="#F59E0B" />
              {stats.pendingOrders > 0 && (
                <View style={styles.statBadge}>
                  <Text style={styles.statBadgeText}>{stats.pendingOrders}</Text>
                </View>
              )}
            </View>
            <Text style={styles.statValue}>{statsLoading ? "—" : stats.pendingOrders}</Text>
            <Text style={styles.statLabel}>En attente</Text>
          </TouchableOpacity>

          {/* Carte Revenu total - non cliquable */}
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="cash" size={24} color="#10B981" />
            </View>
            <Text style={styles.statValue}>
              {statsLoading ? "—" : formatPrice(stats.totalRevenue)}
            </Text>
            <Text style={styles.statLabel}>Revenu total</Text>
          </View>
        </View>

        {/* Actions rapides */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/suppliers/orders')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="cart" size={24} color="#F59E0B" />
            </View>
            <Text style={styles.actionLabel}>Commandes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/seller/add-product')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="add-circle" size={24} color="#0EA5E9" />
            </View>
            <Text style={styles.actionLabel}>Ajouter produit</Text>
          </TouchableOpacity>

          {/* Bouton Catalogue - redirige vers /catalogue */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/catalogue')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#E9D5FF' }]}>
              <Ionicons name="grid" size={24} color="#A855F7" />
            </View>
            <Text style={styles.actionLabel}>Catalogue</Text>
          </TouchableOpacity>
        </View>

        {/* Messages récents */}
        <View style={styles.recentSection}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => router.push('/supplier/messages')}
          >
            <View style={styles.sectionTitleContainer}>
              <Text style={styles.sectionTitle}>Messages récents</Text>
              {stats.unreadMessages > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{stats.unreadMessages}</Text>
                </View>
              )}
            </View>
            <View style={styles.sectionHeaderRight}>
              <Text style={styles.seeAllText}>Voir tout</Text>
              <Ionicons name="chevron-forward" size={16} color="#3B82F6" />
            </View>
          </TouchableOpacity>

          {statsLoading && recentMessages.length === 0 ? (
            <View style={styles.inlineLoader}>
              <ActivityIndicator color="#3B82F6" />
              <Text style={styles.inlineLoaderText}>Chargement des messages…</Text>
            </View>
          ) : recentMessages.length === 0 ? (
            <TouchableOpacity 
              style={styles.emptyState}
              onPress={() => router.push('/supplier/messages')}
            >
              <Ionicons name="chatbubbles-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyStateTitle}>Aucun message</Text>
              <Text style={styles.emptyStateText}>
                Les conversations avec vos clients apparaîtront ici
              </Text>
            </TouchableOpacity>
          ) : (
            recentMessages.map((message) => (
              <TouchableOpacity
                key={message.id}
                style={[styles.messageItem, message.unread && styles.unreadMessage]}
                onPress={() => router.push(`/conversation/${message.conversationId}`)}
              >
                <View style={styles.messageAvatar}>
                  <Text style={styles.messageAvatarText}>
                    {message.senderName.charAt(0)}
                  </Text>
                </View>
                <View style={styles.messageInfo}>
                  <View style={styles.messageHeader}>
                    <Text style={styles.messageSender}>{message.senderName}</Text>
                    <Text style={styles.messageTime}>{formatDate(message.timestamp)}</Text>
                  </View>
                  <Text 
                    style={[styles.messagePreview, message.unread && styles.unreadMessageText]}
                    numberOfLines={1}
                  >
                    {message.lastMessage}
                  </Text>
                </View>
                {message.unread && <View style={styles.messageDot} />}
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Activités récentes (commandes) */}
        <View style={styles.recentSection}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => router.push('/suppliers/orders')}
          >
            <Text style={styles.sectionTitle}>Commandes récentes</Text>
            <View style={styles.sectionHeaderRight}>
              <Text style={styles.seeAllText}>Voir tout</Text>
              <Ionicons name="chevron-forward" size={16} color="#3B82F6" />
            </View>
          </TouchableOpacity>

          {statsLoading && recentOrders.length === 0 ? (
            <View style={styles.inlineLoader}>
              <ActivityIndicator color="#3B82F6" />
              <Text style={styles.inlineLoaderText}>Chargement des commandes…</Text>
            </View>
          ) : recentOrders.length === 0 ? (
            <TouchableOpacity 
              style={styles.emptyState}
              onPress={() => router.push('/seller/add-product')}
            >
              <Ionicons name="receipt-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyStateTitle}>Aucune commande</Text>
              <Text style={styles.emptyStateText}>
                Commencez par ajouter des produits
              </Text>
            </TouchableOpacity>
          ) : (
            recentOrders.map((order) => (
              <TouchableOpacity
                key={order.id}
                style={styles.orderItem}
                onPress={() => router.push(`/suppliers/orders/${order.id}`)}
              >
                <View style={styles.orderInfo}>
                  <Text style={styles.orderCustomer}>{order.customerName}</Text>
                  <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
                  <Text style={styles.orderItems} numberOfLines={1}>
                    {order.items.map((item) => item.name).join(', ')}
                  </Text>
                </View>

                <View style={styles.orderMeta}>
                  <Text style={styles.orderAmount}>{formatPrice(order.total)}</Text>
                  <View
                    style={[
                      styles.orderStatus,
                      { backgroundColor: `${getStatusColor(order.status)}20` },
                    ]}
                  >
                    <Text
                      style={[
                        styles.orderStatusText,
                        { color: getStatusColor(order.status) },
                      ]}
                    >
                      {getStatusLabel(order.status)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Informations fournisseur */}
        <View style={styles.companyDetails}>
          <Text style={styles.companyDetailsTitle}>Informations fournisseur</Text>
          
          {company?.businessType && (
            <View style={styles.detailRow}>
              <Ionicons name="briefcase-outline" size={18} color="#6B7280" />
              <Text style={styles.detailLabel}>Type d’activité :</Text>
              <Text style={styles.detailValue}>{company.businessType}</Text>
            </View>
          )}
          
          {company?.employees && (
            <View style={styles.detailRow}>
              <Ionicons name="people-outline" size={18} color="#6B7280" />
              <Text style={styles.detailLabel}>Employés :</Text>
              <Text style={styles.detailValue}>{company.employees}</Text>
            </View>
          )}
          
          {company?.annualRevenue && (
            <View style={styles.detailRow}>
              <Ionicons name="trending-up-outline" size={18} color="#6B7280" />
              <Text style={styles.detailLabel}>CA annuel :</Text>
              <Text style={styles.detailValue}>{company.annualRevenue}</Text>
            </View>
          )}
          
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={18} color="#6B7280" />
            <Text style={styles.detailLabel}>Adresse :</Text>
            <Text style={styles.detailValue} numberOfLines={2}>
              {getFullAddress()}
            </Text>
          </View>
        </View>

        {/* Actions supplémentaires */}
        <View style={styles.extraActions}>
          <TouchableOpacity
            style={styles.extraActionItem}
            onPress={() => router.push('/seller/stock')}
          >
            <Ionicons name="layers" size={20} color="#00897B" />
            <Text style={styles.extraActionText}>Stock par produit</Text>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.extraActionItem}
            onPress={() => router.push('/seller/analytics')}
          >
            <Ionicons name="stats-chart" size={20} color="#3B82F6" />
            <Text style={styles.extraActionText}>Analytiques</Text>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.extraActionItem}
            onPress={() => router.push('/supplier/reviews')}
          >
            <Ionicons name="star" size={20} color="#F59E0B" />
            <Text style={styles.extraActionText}>Avis clients</Text>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.extraActionItem}
            onPress={() => router.push('/supplier/settings')}
          >
            <Ionicons name="settings" size={20} color="#6B7280" />
            <Text style={styles.extraActionText}>Paramètres</Text>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  inlineLoader: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  inlineLoaderText: {
    fontSize: 13,
    color: '#6B7280',
  },
  coverImage: {
    width: '100%',
    height: 150,
  },
  coverPlaceholder: {
    width: '100%',
    height: 150,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverPlaceholderText: {
    marginTop: 8,
    fontSize: 14,
    color: '#9CA3AF',
  },
  profileSection: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    padding: 16,
	paddingTop: 8,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoContainer: {
    position: 'relative',
    marginRight: 16,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginTop: -20,
  },
  logoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  logoPlaceholderText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#3B82F6',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  companyInfo: {
    flex: 1,
    marginTop: 8,
  },
  companyName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  companyMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 4,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  verifiedBadge: {
    backgroundColor: '#D1FAE5',
  },
  goldBadge: {
    backgroundColor: '#FEF3C7',
  },
  ratingBadge: {
    backgroundColor: '#FEF3C7',
  },
  activeBadge: {
    backgroundColor: '#EFF6FF',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 4,
    color: '#374151',
  },
  description: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 12,
    lineHeight: 20,
  },
  mainProducts: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  mainProductsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 4,
  },
  mainProductsText: {
    fontSize: 14,
    color: '#111827',
  },
  contactQuick: {
    flexDirection: 'row',
    gap: 12,
  },
  contactQuickItem: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  statBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  statBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  recentSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  messageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  unreadMessage: {
    backgroundColor: '#F0F9FF',
  },
  messageAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  messageAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  messageInfo: {
    flex: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageSender: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  messageTime: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  messagePreview: {
    fontSize: 13,
    color: '#6B7280',
  },
  unreadMessageText: {
    fontWeight: '600',
    color: '#111827',
  },
  messageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    marginLeft: 8,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  orderInfo: {
    flex: 1,
    marginRight: 12,
  },
  orderCustomer: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  orderItems: {
    fontSize: 13,
    color: '#4B5563',
  },
  orderMeta: {
    alignItems: 'flex-end',
  },
  orderAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  orderStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  orderStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  companyDetails: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  companyDetailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
    marginRight: 4,
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 1,
  },
  extraActions: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  extraActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  extraActionText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    marginLeft: 12,
  },
});