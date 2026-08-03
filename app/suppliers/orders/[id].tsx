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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, getDoc, updateDoc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, storage } from '@/config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale/fr';

type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered';

interface VariantAttribute {
  name: string;
  value: string;
}

interface OrderItem {
  id: string;
  cartId?: string;
  name: string;
  quantity: number;
  price: number;
  imageUrl?: string;
  image?: string;
  photoURL?: string;
  variantAttributes?: VariantAttribute[];
  specifications?: string | string[] | Record<string, unknown> | null;
  selectedColor?: string;
  selectedSize?: string;
}

// Modifie l'interface pour inclure le champ fullName de l'adresse
interface Order {
  id: string;
  userId?: string;
  clientId?: string;
  customerId?: string;
  userName?: string; // Optionnel au cas où
  clientName?: string;
  customerName?: string;
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
    fullName?: string;
    phone?: string;
  };
  notes?: string;
  sellerId: string;
}

const statusConfig: Record<OrderStatus, { color: string; bgColor: string; label: string; icon: string; nextAction?: string; nextStatus?: OrderStatus }> = {
  pending: {
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    label: 'En attente de confirmation',
    icon: 'time-outline',
    nextAction: 'Confirmer la commande et préparer',
    nextStatus: 'processing',
  },
  paid: {
    color: '#2563EB',
    bgColor: '#DBEAFE',
    label: 'Payé / En attente de traitement',
    icon: 'card-outline',
    nextAction: 'Passer en préparation',
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
  const [selectedProduct, setSelectedProduct] = useState<OrderItem | null>(null);
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [sendingPackedPhoto, setSendingPackedPhoto] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, [id]);

const fetchOrder = async () => {
  if (!id) return;

  try {
    const orderDoc = await getDoc(doc(db, 'orders', id));

    if (orderDoc.exists()) {
      const data = orderDoc.data();
      const customerId = data.userId || data.clientId || data.customerId || null;

      // 1. Récupération brute de l'adresse (shippingAddress, address ou deliveryAddress)
      const rawAddress = data.shippingAddress || data.address || data.deliveryAddress || null;

      // 2. Extraction du nom, téléphone et email
      let resolvedName =
        data.userName ||
        data.clientName ||
        data.customerName ||
        (typeof rawAddress === 'object' && rawAddress ? rawAddress.fullName || rawAddress.name : '') ||
        '';

      let resolvedPhone =
        data.userPhone ||
        data.clientPhone ||
        (typeof rawAddress === 'object' && rawAddress ? rawAddress.phone || rawAddress.telephone || rawAddress.mobile : '') ||
        '';

      const resolvedEmail =
        data.userEmail ||
        data.clientEmail ||
        (typeof rawAddress === 'object' && rawAddress ? rawAddress.email : '') ||
        '';

      // 3. Secours via la collection 'users' si le nom ou le téléphone est manquant
      if ((!resolvedName || !resolvedPhone) && customerId) {
        const userDoc = await getDoc(doc(db, 'users', customerId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          resolvedName =
            resolvedName ||
            userData?.displayName ||
            userData?.fullName ||
            userData?.name ||
            '';

          resolvedPhone =
            resolvedPhone ||
            userData?.phone ||
            userData?.phoneNumber ||
            userData?.mobile ||
            '';
        }
      }

      // 4. Mappage de l'adresse exactement identique à votre formulaire Checkout
      let shippingAddress = {
        fullName: resolvedName || 'Client inconnu',
        phone: resolvedPhone || '',
        street: '',
        city: '',
        country: '',
        postalCode: '',
        apartment: '',
        building: '',
        floor: '',
        deliveryNote: '',
      };

      if (typeof rawAddress === 'string') {
        shippingAddress.street = rawAddress.trim();
      } else if (rawAddress && typeof rawAddress === 'object') {
        shippingAddress = {
          fullName:
            rawAddress.fullName ||
            rawAddress.name ||
            resolvedName ||
            'Client inconnu',
          phone:
            rawAddress.phone ||
            rawAddress.telephone ||
            rawAddress.mobile ||
            resolvedPhone ||
            '',
          street:
            rawAddress.street ||
            rawAddress.addressLine1 ||
            rawAddress.address ||
            rawAddress.fullAddress ||
            '',
          city:
            rawAddress.city ||
            rawAddress.town ||
            rawAddress.district ||
            rawAddress.commune ||
            '',
          country:
            rawAddress.country ||
            rawAddress.countryCode ||
            '',
          postalCode:
            rawAddress.postalCode ||
            rawAddress.zip ||
            rawAddress.postal_code ||
            '',
          apartment: rawAddress.apartment || '',
          building: rawAddress.building || '',
          floor: rawAddress.floor || '',
          deliveryNote:
            rawAddress.deliveryNote ||
            rawAddress.note ||
            rawAddress.notes ||
            data.notes ||
            '',
        };
      }

      // 5. Normalisation globale de la commande
      const formattedOrder = {
        id: orderDoc.id,
        orderId: data.orderId || orderDoc.id,
        ...data,
        userId: data.userId || data.clientId || data.customerId,
        clientId: data.clientId || data.userId || data.customerId,
        customerId: data.customerId || data.userId || data.clientId,
        userName: resolvedName || 'Client inconnu',
        userPhone: resolvedPhone,
        userEmail: resolvedEmail,
        total: data.total || data.summary?.total || data.totalAmount || 0,
        summary: {
          subtotal: data.summary?.subtotal || data.subtotal || data.total || 0,
          shipping: data.summary?.shipping || data.shippingFee || 0,
          discount: data.summary?.discount || data.discount || 0,
          total: data.total || data.summary?.total || data.totalAmount || 0,
        },
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : undefined),
        shippingAddress,
        items: (data.items || []).map((item: any) => ({
          ...item,
          imageUrl: item.image || item.imageUrl || item.photoURL,
          specifications: item.specifications || item.details || null,
          selectedColor: item.selectedColor || item.color || '',
          selectedSize: item.selectedSize || item.size || '',
        })),
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
    const customerPhone = order?.userPhone || order?.shippingAddress?.phone;
    if (!customerPhone) {
      Alert.alert('Info', 'Numéro de téléphone non disponible');
      return;
    }

    let url = '';
    if (type === 'phone') {
      url = `tel:${customerPhone}`;
    } else {
      const phone = customerPhone.replace(/\D/g, '');
      const message = encodeURIComponent(
        `Bonjour ${order?.shippingAddress?.fullName || order?.userName || 'client'}, je suis le vendeur sur A2Express. Je vous contacte concernant votre commande #${order?.id.slice(-8)}.`
      );
      url = `https://wa.me/${phone}?text=${message}`;
    }

    Linking.openURL(url).catch(() => {
      Alert.alert('Erreur', `Impossible d'ouvrir ${type === 'phone' ? 'le téléphone' : 'WhatsApp'}`);
    });
  };

const handleSendPackedPhoto = async () => {
    if (!order) return;

    const clientId = order.userId || order.clientId || order.customerId;
    if (!clientId) {
      Alert.alert('Info', 'ID du client introuvable pour ouvrir la conversation');
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Info', 'Utilisateur non connecté');
      return;
    }

    try {
      setSendingPackedPhoto(true);
      const chatId = [currentUser.uid, clientId].sort().join('_');
      console.log('Tentative d\'ouverture du chat ID:', chatId);
      
      // Remplacez 'chats' par le nom exact de votre collection de discussions si besoin
      const chatRef = doc(db, 'conversations', chatId);
      const chatSnap = await getDoc(chatRef);

      if (!chatSnap.exists()) {
        console.log('Le chat n\'existe pas, création en cours...');
        await setDoc(chatRef, {
          participants: [currentUser.uid, clientId],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessage: `Photo du colis emballé pour la commande #${order.id}`,
        });
      } else {
        console.log('Le chat existe déjà.');
      }

      const priceText = `${Number(order.total || 0).toLocaleString('fr-FR')} FCFA`;
      const initialMessage = `Photo du colis emballé pour la commande #${order.id} - Montant : ${priceText}`;
      const encodedMessage = encodeURIComponent(initialMessage);
      const sellerId = order.sellerId ? encodeURIComponent(order.sellerId) : '';
      const priceParam = encodeURIComponent(String(Number(order.total || 0)));
      const query = `orderId=${encodeURIComponent(order.id)}&sellerId=${sellerId}&message=${encodedMessage}&price=${priceParam}`;
      
      router.push(`/conversation/${chatId}?${query}`);
    } catch (error) {
      console.error('Erreur détaillée lors de l\'ouverture du chat:', error);
      Alert.alert('Erreur', 'Impossible d\'ouvrir la conversation : ' + (error as Error).message);
    } finally {
      setSendingPackedPhoto(false);
    }
  };

  const openProductDetails = (item: OrderItem) => {
    setSelectedProduct(item);
    setProductModalVisible(true);
  };

  const closeProductDetails = () => {
    setProductModalVisible(false);
    setSelectedProduct(null);
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

  const statusInfo: { color: string; bgColor: string; label: string; icon: string; nextAction?: string; nextStatus?: OrderStatus } = statusConfig[order.status] || statusConfig.pending;
  const showNextAction = order.status === 'paid' || order.status === 'pending' || order.status === 'processing';

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
            {!!(order.shippingAddress?.phone || order.userPhone) && (
              <View style={styles.clientDetail}>
                <Ionicons name="call-outline" size={16} color="#9CA3AF" />
                <Text style={styles.clientDetailText}>{order.shippingAddress?.phone || order.userPhone}</Text>
              </View>
            )}
            {!!order.userEmail && (
              <View style={styles.clientDetail}>
                <Ionicons name="mail-outline" size={16} color="#9CA3AF" />
                <Text style={styles.clientDetailText}>{order.userEmail}</Text>
              </View>
            )}
            {(order.shippingAddress?.street || order.shippingAddress?.city || order.shippingAddress?.country) && (
              <View style={styles.clientDetail}>
                <Ionicons name="location-outline" size={16} color="#9CA3AF" />
                <Text style={styles.clientDetailText}>
                  {[
                    order.shippingAddress?.street,
                    order.shippingAddress?.postalCode,
                    order.shippingAddress?.city,
                    order.shippingAddress?.country,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </Text>
              </View>
            )}
          </View>
        </View>


{/* Liste des produits */}
<View style={styles.section}>
  <Text style={styles.sectionTitle}>Produits commandés</Text>
  {order.items.map((item, index) => {
    const cleanUri = getCleanImage(item);
    
    return (
      <TouchableOpacity
        key={item.id || index.toString()}
        style={styles.productCard}
        activeOpacity={0.8}
        onPress={() => openProductDetails(item)}
      >
        <View style={styles.productImageContainer}>
          {cleanUri ? (
            <Image 
              source={{ uri: cleanUri }} 
              style={styles.productImage}
              resizeMode="cover"
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
          <View style={styles.productHintRow}>
            <Ionicons name="information-circle-outline" size={14} color="#3B82F6" />
            <Text style={styles.productHintText}>Voir les détails</Text>
          </View>
        </View>
      </TouchableOpacity>
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Adresse de livraison</Text>
          <View style={styles.card}>
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={20} color="#6B7280" />
              <Text style={styles.addressText}>
                {[
                  order.shippingAddress?.street,
                  order.shippingAddress?.postalCode,
                  order.shippingAddress?.city,
                  order.shippingAddress?.country,
                ]
                  .filter(Boolean)
                  .join(', ') || 'Aucune adresse de livraison fournie'}
              </Text>
            </View>
          </View>
        </View>

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

      <Modal
        visible={productModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeProductDetails}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Détails du produit</Text>
              <TouchableOpacity onPress={closeProductDetails}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            {selectedProduct && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <Text style={styles.modalProductName}>{selectedProduct.name}</Text>
                <Text style={styles.modalPrice}>{formatPrice(selectedProduct.price)}</Text>

                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalLabel}>Quantité</Text>
                  <Text style={styles.modalValue}>x{selectedProduct.quantity}</Text>
                </View>

                {selectedProduct.selectedColor ? (
                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalLabel}>Couleur</Text>
                    <Text style={styles.modalValue}>{selectedProduct.selectedColor}</Text>
                  </View>
                ) : null}

                {selectedProduct.selectedSize ? (
                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalLabel}>Taille</Text>
                    <Text style={styles.modalValue}>{selectedProduct.selectedSize}</Text>
                  </View>
                ) : null}

                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalLabel}>Référence</Text>
                  <Text style={styles.modalValue}>{selectedProduct.cartId || selectedProduct.id}</Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Spécifications</Text>
                  {selectedProduct.specifications ? (
                    typeof selectedProduct.specifications === 'string' ? (
                      <Text style={styles.modalText}>{selectedProduct.specifications}</Text>
                    ) : Array.isArray(selectedProduct.specifications) ? (
                      selectedProduct.specifications.map((spec, index) => (
                        <Text key={`${spec}-${index}`} style={styles.modalBullet}>• {String(spec)}</Text>
                      ))
                    ) : typeof selectedProduct.specifications === 'object' ? (
                      Object.entries(selectedProduct.specifications).map(([key, value]) => (
                        <View key={key} style={styles.modalListRow}>
                          <Text style={styles.modalLabel}>{key}</Text>
                          <Text style={styles.modalValue}>{String(value)}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.modalText}>Aucune information disponible</Text>
                    )
                  ) : (
                    <Text style={styles.modalText}>Aucune information disponible</Text>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

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

        <TouchableOpacity
          style={[styles.packedPhotoButton, sendingPackedPhoto ? styles.disabledButton : undefined]}
          onPress={handleSendPackedPhoto}
          disabled={sendingPackedPhoto}
        >
          <Ionicons name="camera-outline" size={18} color="#2563EB" />
          {sendingPackedPhoto ? (
            <ActivityIndicator color="#2563EB" style={{ marginLeft: 10 }} />
          ) : (
            <Text style={styles.packedPhotoButtonText}>Envoyer la photo du colis emballé</Text>
          )}
        </TouchableOpacity>

        {showNextAction && statusInfo.nextStatus && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: statusInfo.color },
            ]}
            onPress={() => updateOrderStatus(statusInfo.nextStatus as OrderStatus)}
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
  productHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  productHintText: {
    fontSize: 12,
    color: '#3B82F6',
    marginLeft: 4,
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
  packedPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    marginBottom: 12,
  },
  packedPhotoButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  disabledButton: {
    opacity: 0.6,
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalBody: {
    paddingBottom: 8,
  },
  modalProductName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  modalPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563EB',
    marginBottom: 12,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalLabel: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  modalValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  modalSection: {
    marginTop: 12,
  },
  modalSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  modalText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  modalBullet: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 4,
  },
  modalListRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});