import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Linking, Modal, TextInput, Clipboard, Platform
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

// Configuration des statuts avec couleurs et actions
const statusConfig = {
  confirmed: { 
    color: '#F59E0B', 
    bgColor: '#FEF3C7', 
    label: 'Confirmée', 
    icon: 'checkmark-done-outline',
    nextAction: 'Préparer la commande', 
    nextStatus: 'processing' 
  },
  processing: { 
    color: '#3B82F6', 
    bgColor: '#DBEAFE', 
    label: 'En préparation', 
    icon: 'hammer-outline',
    nextAction: 'Colis prêt', 
    nextStatus: 'shipped' 
  },
  shipped: { 
    color: '#8B5CF6', 
    bgColor: '#EDE9FE', 
    label: 'Expédiée', 
    icon: 'bicycle-outline',
    nextAction: 'Confirmer la livraison', 
    nextStatus: 'delivered' 
  },
  delivered: { 
    color: '#10B981', 
    bgColor: '#D1FAE5', 
    label: 'Livrée', 
    icon: 'happy-outline' 
  },
};

interface Order {
  id: string;
  orderId: string;
  status: keyof typeof statusConfig;
  currency: string;
  total: number;
  createdAt: Timestamp;
  items: Array<{
    name: string;
    imageUrl?: string;
    image?: string;
    photoURL?: string;
    photos?: string[];
    quantity: number;
    price: number;
    companyName: string;
    companyPhone?: string; // Ajout du téléphone fournisseur
    specifications?: {
      volume?: string;
      weight?: string;
      [key: string]: any;
    };
    color?: string;
    size?: string;
  }>;
  shippingAddress: {
    fullName: string;
    phone: string;
    street: string;
    city: string;
    postalCode?: string;
    country: string;
  };
  summary?: {
    subtotal: number;
    shipping: number;
    total: number;
  };
  provider: string;
}

export default function OrderDetailsAdmin() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [targetPhone, setTargetPhone] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<{name: string, company: string, phone?: string} | null>(null);
  const [notifiedSuppliers, setNotifiedSuppliers] = useState<Set<string>>(new Set());

  useEffect(() => { 
    fetchOrder(); 
  }, [id]);

  const fetchOrder = async () => {
    if (!id) return;
    try {
      const orderDoc = await getDoc(doc(db, 'orders', id));
      if (orderDoc.exists()) {
        setOrder({ id: orderDoc.id, ...orderDoc.data() } as Order);
      } else { 
        Alert.alert('Erreur', 'Commande non trouvée');
        router.back(); 
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger la commande');
      console.error(error);
    } finally { 
      setLoading(false); 
    }
  };

  // Fonction de nettoyage d'URL Firebase Storage (LA SOLUTION)
  const getCleanImage = (item: any) => {
    // 1. On récupère l'URL peu importe le nom du champ (imageUrl ou image)
    let uri = item.imageUrl || item.image || item.photoURL || item.photos?.[0];
    
    if (!uri || typeof uri !== 'string') return null;

    try {
      // 2. .trim() enlève les espaces vides au début et à la fin
      // 3. .replace(...) avec la Regex supprime les caractères invisibles/spéciaux
      let clean = uri.trim().replace(/[\s\u0000-\u001F\u007F-\u009F\uFEFF]+/g, '');

      // 4. Correction spécifique Firebase : On remplace le slash du dossier par le code %2F
      if (clean.includes('/products/') && !clean.includes('products%2F')) {
        clean = clean.replace('/products/', '/products%2F');
      }
      return clean;
    } catch (e) { 
      return uri; // En cas d'erreur, on renvoie l'original par sécurité
    }
  };

  const updateOrderStatus = async (newStatus: string) => {
    if (!order || updating) return;
    
    Alert.alert(
      'Confirmer le changement',
      `Passer la commande au statut "${statusConfig[newStatus as keyof typeof statusConfig]?.label}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setUpdating(true);
            try {
              await updateDoc(doc(db, 'orders', order.id), { 
                status: newStatus, 
                updatedAt: Timestamp.now() 
              });
              setOrder({ ...order, status: newStatus as keyof typeof statusConfig });
              Alert.alert('Succès', 'Statut mis à jour');
            } catch (error) {
              Alert.alert('Erreur', 'Mise à jour échouée');
              console.error(error);
            } finally { 
              setUpdating(false); 
            }
          }
        }
      ]
    );
  };

  // Fonction pour notifier TOUS les fournisseurs en une fois
  const notifyAllSuppliers = () => {
    if (!order) return;
    
    const suppliers = order.items.reduce((acc: any[], item) => {
      if (!acc.find(s => s.company === item.companyName)) {
        acc.push({
          company: item.companyName,
          phone: item.companyPhone,
          items: order.items.filter(i => i.companyName === item.companyName)
        });
      }
      return acc;
    }, []);

    if (suppliers.length === 0) {
      Alert.alert('Info', 'Aucun fournisseur à notifier');
      return;
    }

    // Si un seul fournisseur, on ouvre directement le modal
    if (suppliers.length === 1) {
      const supplier = suppliers[0];
      const itemsList = supplier.items.map((i: any) => `• ${i.name} (x${i.quantity})`).join('\n');
      
      setSelectedSupplier({ 
        name: supplier.items[0].name, 
        company: supplier.company,
        phone: supplier.phone 
      });
      setMessage(
        `Bonjour ${supplier.company},\n\n` +
        `Vous avez reçu une nouvelle commande sur A2Express !\n\n` +
        `📦 Commande N°: ${order.orderId}\n` +
        `📋 Articles commandés :\n${itemsList}\n\n` +
        `Merci de préparer la commande dans les plus brefs délais.\n\n` +
        `Cordialement,\nL'équipe A2Express`
      );
      setTargetPhone(supplier.phone || "");
      setModalVisible(true);
    } else {
      // Plusieurs fournisseurs : on propose de choisir
      Alert.alert(
        'Notifier les fournisseurs',
        'Voulez-vous notifier tous les fournisseurs ou un par un ?',
        [
          { text: 'Un par un', onPress: () => notifySuppliersOneByOne(suppliers) },
          { text: 'Tous', onPress: () => notifyAllSuppliersAtOnce(suppliers) },
          { text: 'Annuler', style: 'cancel' }
        ]
      );
    }
  };

  const notifySuppliersOneByOne = (suppliers: any[]) => {
    let currentIndex = 0;

    const notifyNext = () => {
      if (currentIndex >= suppliers.length) {
        Alert.alert('Succès', 'Tous les fournisseurs ont été notifiés');
        return;
      }

      const supplier = suppliers[currentIndex];
      const itemsList = supplier.items.map((i: any) => `• ${i.name} (x${i.quantity})`).join('\n');
      
      Alert.alert(
        `Fournisseur ${currentIndex + 1}/${suppliers.length}`,
        `Notifier ${supplier.company} ?`,
        [
          { 
            text: 'Notifier', 
            onPress: () => {
              setSelectedSupplier({ 
                name: supplier.items[0].name, 
                company: supplier.company,
                phone: supplier.phone 
              });
              setMessage(
                `Bonjour ${supplier.company},\n\n` +
                `Vous avez reçu une nouvelle commande sur A2Express !\n\n` +
                `📦 Commande N°: ${order?.orderId}\n` +
                `📋 Articles commandés :\n${itemsList}\n\n` +
                `Merci de préparer la commande dans les plus brefs délais.\n\n` +
                `Cordialement,\nL'équipe A2Express`
              );
              setTargetPhone(supplier.phone || "");
              setModalVisible(true);
              
              // On passe au suivant après fermeture du modal
              const interval = setInterval(() => {
                if (!modalVisible) {
                  clearInterval(interval);
                  currentIndex++;
                  notifyNext();
                }
              }, 500);
            }
          },
          { text: 'Passer', onPress: () => { currentIndex++; notifyNext(); } },
          { text: 'Annuler' }
        ]
      );
    };

    notifyNext();
  };

  const notifyAllSuppliersAtOnce = (suppliers: any[]) => {
    const groupsMessage = suppliers.map(s => 
      `🏭 ${s.company} :\n${s.items.map((i: any) => `  • ${i.name} (x${i.quantity})`).join('\n')}`
    ).join('\n\n');

    Alert.alert(
      'Notifier tous les fournisseurs',
      'Choisissez le mode de notification',
      [
        {
          text: 'WhatsApp Groupes',
          onPress: () => {
            // Idéalement ici vous auriez un lien de groupe WhatsApp
            Alert.alert('Info', 'Fonctionnalité de groupe WhatsApp à configurer');
          }
        },
        {
          text: 'Copier la liste',
          onPress: () => {
            Clipboard.setString(groupsMessage);
            Alert.alert('✅ Copié', 'Liste des fournisseurs copiée');
          }
        },
        { text: 'Annuler', style: 'cancel' }
      ]
    );
  };

  const markSupplierNotified = (companyName: string) => {
    setNotifiedSuppliers(prev => {
      const newSet = new Set(prev);
      newSet.add(companyName);
      return newSet;
    });
  };

  const openWhatsApp = (phone: string, customMessage?: string) => {
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    const defaultMessage = customMessage || message;
    Linking.openURL(`whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(defaultMessage)}`);
  };

  const formatCurrency = (amount: number, currency: string = 'XOF') => {
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={styles.loadingText}>Chargement de la commande...</Text>
      </View>
    );
  }

  if (!order) return null;

  const statusInfo = statusConfig[order.status] || statusConfig.confirmed;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header avec ID commande */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Gestion Commande</Text>
          <Text style={styles.headerSubtitle}>{order.orderId || id?.slice(-8).toUpperCase()}</Text>
        </View>
        
        <TouchableOpacity 
          onPress={() => {
            Clipboard.setString(order.orderId || id || '');
            Alert.alert("✅ Copié", "ID commande dans le presse-papier");
          }}
          style={styles.headerButton}
        >
          <Ionicons name="copy-outline" size={22} color="#666" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {/* Badge de statut en bannière */}
        <View style={[styles.statusBanner, { backgroundColor: statusInfo.bgColor }]}>
          <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
          <Text style={[styles.statusBannerText, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
          <Text style={styles.dateText}>{formatDate(order.createdAt)}</Text>
        </View>

        {/* Carte de statut détaillée */}
        <View style={[styles.statusCard, { borderLeftColor: statusInfo.color }]}>
          <View style={[styles.statusIconBox, { backgroundColor: statusInfo.bgColor }]}>
            <Ionicons name={statusInfo.icon as any} size={30} color={statusInfo.color} />
          </View>
          <View style={styles.statusContent}>
            <Text style={styles.statusLabel}>État actuel</Text>
            <Text style={[styles.statusValue, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        {/* Bouton de notification groupée pour les fournisseurs */}
        <View style={styles.bulkActionContainer}>
          <TouchableOpacity 
            style={styles.bulkNotifyButton}
            onPress={notifyAllSuppliers}
          >
            <FontAwesome name="whatsapp" size={20} color="#FFF" />
            <Text style={styles.bulkNotifyText}>Notifier tous les fournisseurs</Text>
          </TouchableOpacity>
        </View>

        {/* Liste des produits avec variantes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📦 Articles à préparer</Text>
          {order.items?.map((item, index) => {
            const imageUrl = getCleanImage(item); // Utilisation de la fonction qui résout le problème d'image
            const isNotified = notifiedSuppliers.has(item.companyName);
            
            return (
              <View key={index} style={styles.productCard}>
                {/* Affichage de l'image avec expo-image et l'URL nettoyée */}
                <Image 
                  source={imageUrl ? { uri: imageUrl } : null}
                  style={styles.productImage} 
                  contentFit="cover"
                  transition={300}
                  cachePolicy="disk"
                  // Remplace require(...) par null
placeholder={null}
                  recyclingKey={imageUrl}
                />
                
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                  
                  {/* Affichage des spécifications / variantes */}
                  <View style={styles.specsContainer}>
                    {item.specifications?.weight && item.specifications.weight !== "0" && (
                      <View style={styles.specBadge}>
                        <MaterialCommunityIcons name="weight" size={12} color="#666" />
                        <Text style={styles.specText}>{item.specifications.weight} kg</Text>
                      </View>
                    )}
                    
                    {item.specifications?.volume && item.specifications.volume !== "0" && (
                      <View style={styles.specBadge}>
                        <MaterialCommunityIcons name="cube-outline" size={12} color="#666" />
                        <Text style={styles.specText}>{item.specifications.volume}</Text>
                      </View>
                    )}
                    
                    {item.color && (
                      <View style={[styles.specBadge, { backgroundColor: '#F0F2F5' }]}>
                        <View style={[styles.colorDot, { backgroundColor: item.color.toLowerCase() }]} />
                        <Text style={styles.specText}>{item.color}</Text>
                      </View>
                    )}
                    
                    {item.size && (
                      <View style={styles.specBadge}>
                        <Text style={styles.specText}>Taille: {item.size}</Text>
                      </View>
                    )}
                  </View>

                  {/* Quantité et fournisseur */}
                  <View style={styles.productFooter}>
                    <View style={styles.quantityContainer}>
                      <Text style={styles.quantityLabel}>Qté:</Text>
                      <Text style={styles.quantityValue}>{item.quantity}</Text>
                    </View>
                    
                    <TouchableOpacity 
                      onPress={() => {
                        setSelectedSupplier({ 
                          name: item.name, 
                          company: item.companyName,
                          phone: item.companyPhone 
                        });
                        
                        // Message personnalisé pour ce fournisseur avec TOUS ses articles
                        const supplierItems = order.items.filter(i => i.companyName === item.companyName);
                        const itemsList = supplierItems.map(i => `• ${i.name} (x${i.quantity})`).join('\n');
                        
                        setMessage(
                          `Bonjour ${item.companyName},\n\n` +
                          `Vous avez reçu une nouvelle commande sur A2Express !\n\n` +
                          `📦 Commande N°: ${order.orderId}\n` +
                          `📋 Articles commandés :\n${itemsList}\n\n` +
                          `Merci de préparer la commande dans les plus brefs délais.\n\n` +
                          `Cordialement,\nL'équipe A2Express`
                        );
                        setTargetPhone(item.companyPhone || "");
                        setModalVisible(true);
                      }}
                      style={[
                        styles.supplierButton,
                        isNotified && styles.supplierButtonNotified
                      ]}
                    >
                      <FontAwesome 
                        name={isNotified ? "check" : "whatsapp"} 
                        size={14} 
                        color={isNotified ? "#10B981" : "#25D366"} 
                      />
                      <Text 
                        style={[
                          styles.supplierText,
                          isNotified && styles.supplierTextNotified
                        ]} 
                        numberOfLines={1}
                      >
                        {item.companyName}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* Résumé financier */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💰 Résumé financier</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Sous-total</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(order.summary?.subtotal || order.total, order.currency)}
              </Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Frais de livraison</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(order.summary?.shipping || 0, order.currency)}
              </Text>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL À ENCAISSER</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(order.total, order.currency)}
              </Text>
            </View>
            
            <View style={styles.paymentBadge}>
              <MaterialCommunityIcons name="credit-card" size={16} color="#666" />
              <Text style={styles.paymentText}>
                Paiement via {order.provider?.toUpperCase() || 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        {/* Informations client */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👤 Client & Livraison</Text>
          <View style={styles.clientCard}>
            <View style={styles.clientHeader}>
              <Ionicons name="person-circle" size={48} color="#CCC" />
              <View style={styles.clientInfo}>
                <Text style={styles.clientName}>{order.shippingAddress?.fullName}</Text>
                <TouchableOpacity 
                  style={styles.phoneLink}
                  onPress={() => Linking.openURL(`tel:${order.shippingAddress?.phone}`)}
                >
                  <Ionicons name="call-outline" size={14} color="#FF6B00" />
                  <Text style={styles.clientPhone}>{order.shippingAddress?.phone}</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.addressContainer}>
              <Ionicons name="location-outline" size={20} color="#FF6B00" />
              <View style={styles.addressTextContainer}>
                <Text style={styles.addressLine}>{order.shippingAddress?.street}</Text>
                <Text style={styles.addressLine}>
                  {order.shippingAddress?.postalCode} {order.shippingAddress?.city}
                </Text>
                <Text style={styles.addressLine}>{order.shippingAddress?.country}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Espace supplémentaire pour le footer fixe */}
        <View style={styles.footerSpacer} />
      </ScrollView>

      {/* Footer avec actions principales - fixé en bas avec SafeAreaView */}
      <SafeAreaView style={styles.footer} edges={['bottom']}>
        <View style={styles.footerContent}>
          <View style={styles.contactButtons}>
            <TouchableOpacity 
              style={[styles.contactButton, { borderColor: '#3B82F6' }]} 
              onPress={() => Linking.openURL(`tel:${order.shippingAddress?.phone}`)}
            >
              <Ionicons name="call" size={22} color="#3B82F6" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.contactButton, { borderColor: '#25D366' }]} 
              onPress={() => { 
                setTargetPhone(order.shippingAddress?.phone || ""); 
                setMessage(
                  `Bonjour ${order.shippingAddress?.fullName},\n\n` +
                  `Nous faisons suite à votre commande ${order.orderId}.\n` +
                  `Statut actuel: ${statusInfo.label}\n` +
                  `N'hésitez pas à nous contacter pour plus d'informations.\n\n` +
                  `Cordialement,\nL'équipe A2Express`
                ); 
                setSelectedSupplier(null);
                setModalVisible(true); 
              }}
            >
              <FontAwesome name="whatsapp" size={22} color="#25D366" />
            </TouchableOpacity>
          </View>
          
          {statusInfo.nextStatus && (
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: statusInfo.color }]}
              onPress={() => updateOrderStatus(statusInfo.nextStatus)}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.actionButtonText}>{statusInfo.nextAction}</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFF" />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {/* Modal WhatsApp pour contacter client/fournisseur */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {selectedSupplier ? 'Contacter le fournisseur' : 'Contacter le client'}
                </Text>
                {selectedSupplier && (
                  <Text style={styles.modalSubtitle}>{selectedSupplier.company}</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalClose}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <TextInput 
              style={styles.phoneInput} 
              placeholder="Numéro de téléphone (ex: +223...)" 
              value={targetPhone} 
              onChangeText={setTargetPhone} 
              keyboardType="phone-pad"
              placeholderTextColor="#999"
            />
            
            <TextInput 
              style={styles.messageInput} 
              multiline 
              value={message} 
              onChangeText={setMessage} 
              placeholder="Votre message..."
              placeholderTextColor="#999"
              textAlignVertical="top"
            />
            
            <TouchableOpacity 
              style={styles.sendButton} 
              onPress={() => {
                if (!targetPhone) {
                  Alert.alert('Erreur', 'Veuillez saisir un numéro de téléphone');
                  return;
                }
                openWhatsApp(targetPhone, message);
                if (selectedSupplier) {
                  markSupplierNotified(selectedSupplier.company);
                }
                setModalVisible(false);
              }}
            >
              <FontAwesome name="whatsapp" size={22} color="#FFF" />
              <Text style={styles.sendButtonText}>Envoyer via WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F5F7F9' 
  },
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#F5F7F9'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    fontWeight: '500'
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: { 
    fontSize: 11, 
    color: '#999', 
    fontWeight: '700', 
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerSubtitle: { 
    fontSize: 16, 
    fontWeight: '800', 
    color: '#111',
    marginTop: 2,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusBannerText: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  dateText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  statusIconBox: { 
    width: 50, 
    height: 50, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  statusContent: {
    marginLeft: 15,
    flex: 1,
  },
  statusLabel: { 
    fontSize: 12, 
    color: '#666',
    marginBottom: 4,
  },
  statusValue: { 
    fontSize: 18, 
    fontWeight: '900',
  },
  scrollContent: { 
    paddingBottom: 100,
  },
  section: { 
    paddingHorizontal: 16, 
    marginTop: 24,
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: '800', 
    marginBottom: 12, 
    color: '#333',
    letterSpacing: 0.5,
  },
  bulkActionContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  bulkNotifyButton: {
    backgroundColor: '#25D366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
  },
  bulkNotifyText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  productCard: { 
    flexDirection: 'row', 
    backgroundColor: '#FFF', 
    padding: 12, 
    borderRadius: 16, 
    marginBottom: 12,
    shadowColor: '#000', 
    shadowOpacity: 0.03, 
    shadowRadius: 8, 
    elevation: 2,
  },
  productImage: { 
    width: 90, 
    height: 90, 
    borderRadius: 12, 
    backgroundColor: '#F5F5F5' 
  },
  noImageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  productInfo: { 
    flex: 1, 
    marginLeft: 15,
  },
  productName: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#111', 
    lineHeight: 20,
    marginBottom: 8,
  },
  specsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  specBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  specText: {
    fontSize: 11,
    color: '#555',
    fontWeight: '600',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  quantityLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 4,
  },
  quantityValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FF6B00',
  },
  supplierButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F2F5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    maxWidth: '60%',
  },
  supplierButtonNotified: {
    backgroundColor: '#E8F5E9',
  },
  supplierText: {
    fontSize: 12,
    color: '#FF6B00',
    fontWeight: '600',
  },
  supplierTextNotified: {
    color: '#10B981',
  },
  summaryCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    color: '#666',
    fontSize: 14,
  },
  summaryValue: {
    fontWeight: '600',
    color: '#111',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FF6B00',
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 8,
  },
  paymentText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  clientCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientInfo: {
    marginLeft: 12,
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111',
    marginBottom: 4,
  },
  phoneLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clientPhone: {
    fontSize: 14,
    color: '#666',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  addressTextContainer: {
    flex: 1,
  },
  addressLine: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  footerSpacer: {
    height: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  contactButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  actionButton: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  actionButtonText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    minHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  modalClose: {
    padding: 4,
  },
  phoneInput: {
    backgroundColor: '#F5F7F9',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    fontSize: 15,
    color: '#111',
  },
  messageInput: {
    backgroundColor: '#F5F7F9',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    fontSize: 15,
    color: '#111',
    height: 120,
  },
  sendButton: {
    backgroundColor: '#25D366',
    flexDirection: 'row',
    height: 55,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  sendButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
});