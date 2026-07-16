// apps/mobile/app/suppliers/orders/[id].tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale/fr';

type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered';

interface VariantAttribute {
  name: string;
  value: string;
}

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  imageUrl?: string;
  variantAttributes?: VariantAttribute[];
}

// Modifie l'interface pour inclure le champ fullName de l'adresse
interface Order {
  id: string;
  userName?: string; // Optionnel au cas où
  userPhone?: string;
  userEmail?: string;
  total: number;      // Changé de totalAmount à total
  baseAmount?: number;
  priceAdjustment?: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt?: Date;
  items: OrderItem[];
  shippingAddress?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
    fullName?: string; // Ajouté ici
  };
  notes?: string;
  sellerId: string;
}

const statusConfig = {
  pending: {
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    label: 'En attente de confirmation',
    icon: 'time-outline',
    nextAction: 'Confirmer la commande et préparer',
    nextStatus: 'processing',
  },
  processing: {
    color: '#3B82F6',
    bgColor: '#DBEAFE',
    label: 'En cours de préparation',
    icon: 'cog-outline',
    nextAction: 'Colis prêt et expédié',
    nextStatus: 'shipped',
  },
  shipped: {
    color: '#8B5CF6',
    bgColor: '#EDE9FE',
    label: 'Expédié',
    icon: 'cube-outline',
  },
  delivered: {
    color: '#10B981',
    bgColor: '#D1FAE5',
    label: 'Livré',
    icon: 'checkmark-circle-outline',
  },
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, [id]);

const fetchOrder = async () => {
    if (!id) return;

    try {
      const orderDoc = await getDoc(doc(db, 'orders', id));
      
      if (orderDoc.exists()) {
        const data = orderDoc.data();
        
        // On prépare l'objet avec les bonnes correspondances Firestore -> TypeScript
        const formattedOrder = {
          id: orderDoc.id,
          ...data,
          // 1. On récupère le nom là où il se trouve réellement (shippingAddress)
          userName: data.userName || data.shippingAddress?.fullName || 'Client inconnu',
          
          // 2. On s'assure que le téléphone est bien récupéré pour les boutons d'action
          userPhone: data.userPhone || data.shippingAddress?.phone || '',
          
          // 3. On mappe 'total' de Firestore vers 'totalAmount' (ou on garde 'total')
          // Pour ton cas, on s'assure qu'un prix existe pour éviter le crash .toLocaleString()
          total: data.total || data.totalAmount || 0,
          
          // 4. Conversion des dates Firebase
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate(),
          
          // 5. Correction des items (image vs imageUrl)
          items: (data.items || []).map((item: any) => ({
            ...item,
            imageUrl: item.image || item.imageUrl // Supporte les deux noms de champ
          }))
        } as Order;

        setOrder(formattedOrder);
      } else {
        Alert.alert('Erreur', 'Commande introuvable');
        router.back();
      }
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      Alert.alert('Erreur', 'Impossible de charger la commande');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (newStatus: OrderStatus) => {
    if (!order || updating) return;

    setUpdating(true);
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: newStatus,
        updatedAt: new Date(),
      });

      // Mettre à jour l'état local
      setOrder({ ...order, status: newStatus, updatedAt: new Date() });

      Alert.alert('Succès', 'Statut de la commande mis à jour');
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut');
    } finally {
      setUpdating(false);
    }
  };

  const handleContact = (type: 'phone' | 'whatsapp') => {
    if (!order?.userPhone) {
      Alert.alert('Info', 'Numéro de téléphone non disponible');
      return;
    }

let url = '';
    if (type === 'phone') {
      url = `tel:${order.userPhone}`;
    } else {
      // Format international sans le + pour WhatsApp
      const phone = order.userPhone.replace(/\D/g, '');
      
      // Ajout d'un message automatique pour faciliter le contact
      const message = encodeURIComponent(
        `Bonjour ${order.userName}, je suis le vendeur sur A2Express. Je vous contacte concernant votre commande #${order.id.slice(-8)}.`
      );
      
      url = `https://wa.me/${phone}?text=${message}`;
    }

    Linking.openURL(url).catch(() => {
      Alert.alert('Erreur', `Impossible d'ouvrir ${type === 'phone' ? 'le téléphone' : 'WhatsApp'}`);
    });
  };

const formatPrice = (price: number) => {
  // On utilise 0 si price est undefined ou null
  const safePrice = price || 0; 
  return `${safePrice.toLocaleString('fr-FR')} XOF`;
};

  const formatDate = (date: Date) => {
    return format(date, 'dd MMMM yyyy • HH:mm', { locale: fr });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Chargement de la commande...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text style={styles.errorText}>Commande introuvable</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // SYSTÈME DE NETTOYAGE D'IMAGE (À placer ici)
  const getCleanImage = (item: any) => {
    if (!item) return null;
    // On cherche dans tous les champs possibles (image, imageUrl, photoURL)
    let uri = item.image || item.imageUrl || item.photoURL;
    if (!uri || typeof uri !== 'string') return null;

    try {
      // Nettoyage des caractères invisibles, espaces et sauts de ligne
      let clean = uri.trim().replace(/[\s\u0000-\u001F\u007F-\u009F\uFEFF]+/g, '');
      
      // Correction spécifique pour les dossiers Firebase Storage (slash vs %2F)
      if (clean.includes('/products/') && !clean.includes('products%2F')) {
        clean = clean.replace('/products/', '/products%2F');
      }
      return clean;
    } catch (e) {
      return uri;
    }
  };

const statusInfo = statusConfig[order.status] || statusConfig.pending;
  const showNextAction = order.status === 'pending' || order.status === 'processing';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header avec navigation */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backIcon}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Commande</Text>
          <Text style={styles.headerSubtitle}>#{order.id.slice(-8)}</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Statut actuel */}
        <View style={[styles.statusBanner, { backgroundColor: statusInfo.bgColor }]}>
          <Ionicons name={statusInfo.icon as any} size={24} color={statusInfo.color} />
          <View style={styles.statusTextContainer}>
            <Text style={styles.statusLabel}>Statut actuel</Text>
            <Text style={[styles.statusValue, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        {/* Informations client */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client</Text>
          <View style={styles.card}>
            <View style={styles.clientInfo}>
              <Ionicons name="person-outline" size={20} color="#6B7280" />
              <Text style={styles.clientName}>
                {order.shippingAddress?.fullName || order.userName || 'Client inconnu'}
              </Text>
            </View>
            {!!order.userEmail && (
              <View style={styles.clientDetail}>
                <Ionicons name="mail-outline" size={16} color="#9CA3AF" />
                <Text style={styles.clientDetailText}>{order.userEmail}</Text>
              </View>
            )}
            {!!order.userPhone && (
              <View style={styles.clientDetail}>
                <Ionicons name="call-outline" size={16} color="#9CA3AF" />
                <Text style={styles.clientDetailText}>{order.userPhone}</Text>
              </View>
            )}
          </View>
        </View>


{/* Liste des produits */}
<View style={styles.section}>
  <Text style={styles.sectionTitle}>Produits commandés</Text>
  {order.items.map((item, index) => {
    const cleanUri = getCleanImage(item); // On calcule l'URL propre ici
    
    return (
      <View key={item.id || index.toString()} style={styles.productCard}>
        <View style={styles.productImageContainer}>
          {cleanUri ? (
            <Image 
              source={{ uri: cleanUri }} 
              style={styles.productImage}
              contentFit="cover" // Si tu utilises expo-image
              transition={300}
            />
          ) : (
            <View style={styles.productImagePlaceholder}>
              <Ionicons name="image-outline" size={24} color="#9CA3AF" />
            </View>
          )}
        </View>
        
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{item.name}</Text>
          <View style={styles.productPricing}>
            <Text style={styles.productQuantity}>x{item.quantity}</Text>
            <Text style={styles.productPrice}>{formatPrice(item.price)}</Text>
          </View>
        </View>
      </View>
    );
  })}
</View>

        {/* Résumé financier */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Résumé financier</Text>
          <View style={styles.card}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Sous-total</Text>
              <Text style={styles.priceValue}>
                {formatPrice(order.total)}
              </Text>
            </View>
            
            {order.priceAdjustment ? (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Ajustement</Text>
                <Text style={[styles.priceValue, styles.adjustmentText]}>
                  {order.priceAdjustment > 0 ? '+' : '-'} 
                  {formatPrice(Math.abs(order.priceAdjustment))}
                </Text>
              </View>
            ) : null}
            
            <View style={styles.divider} />
            
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatPrice(order.total)}</Text>
            </View>
          </View>
        </View>

        {/* Adresse de livraison */}
        {order.shippingAddress && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Adresse de livraison</Text>
            <View style={styles.card}>
              <View style={styles.addressRow}>
                <Ionicons name="location-outline" size={20} color="#6B7280" />
                <Text style={styles.addressText}>
                  {order.shippingAddress.street}
                  {order.shippingAddress.postalCode
                    ? `, ${order.shippingAddress.postalCode}`
                    : ''}{' '}
                  {order.shippingAddress.city}, {order.shippingAddress.country}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Notes */}
        {order.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.card}>
              <Text style={styles.notesText}>{order.notes}</Text>
            </View>
          </View>
        )}

        {/* Infos supplémentaires */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations supplémentaires</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
              <Text style={styles.infoLabel}>Commandé le :</Text>
              <Text style={styles.infoValue}>{formatDate(order.createdAt)}</Text>
            </View>
            {order.updatedAt && (
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={16} color="#9CA3AF" />
                <Text style={styles.infoLabel}>Dernière mise à jour :</Text>
                <Text style={styles.infoValue}>{formatDate(order.updatedAt)}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Actions fixes */}
      <View style={styles.footer}>
        <View style={styles.contactButtons}>
          <TouchableOpacity
            style={[styles.contactButton, styles.phoneButton]}
            onPress={() => handleContact('phone')}
          >
            <Ionicons name="call" size={20} color="#3B82F6" />
            <Text style={styles.contactButtonText}>Appeler</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.contactButton, styles.whatsappButton]}
            onPress={() => handleContact('whatsapp')}
          >
            <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
            <Text style={styles.contactButtonText}>WhatsApp</Text>
          </TouchableOpacity>
        </View>

        {showNextAction && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: statusInfo.color },
            ]}
            onPress={() => updateOrderStatus(statusConfig[order.status].nextStatus as OrderStatus)}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>
                  {statusInfo.nextAction}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#374151',
    marginTop: 16,
    marginBottom: 20,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backIcon: {
    padding: 4,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  headerSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 2,
  },
  placeholder: {
    width: 32,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  statusTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  statusLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  clientDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginLeft: 4,
  },
  clientDetailText: {
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 8,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  productImageContainer: {
    width: 70,
    height: 70,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  variantsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  variantBadge: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 4,
  },
  variantLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginRight: 4,
  },
  variantValue: {
    fontSize: 11,
    fontWeight: '500',
    color: '#111827',
  },
  productPricing: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  productQuantity: {
    fontSize: 13,
    color: '#6B7280',
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  adjustmentText: {
    color: '#10B981',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3B82F6',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 8,
    lineHeight: 20,
  },
  notesText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 6,
    marginRight: 4,
  },
  infoValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
    flex: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    padding: 16,
    paddingBottom: 32,
  },
  contactButtons: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginHorizontal: 4,
  },
  phoneButton: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  whatsappButton: {
    borderColor: '#25D366',
    backgroundColor: '#E8F5E9',
  },
  contactButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});