import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, Clipboard, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  arrayUnion,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAdminStatusUi,
  normalizeAdminOrderStatus,
  type AdminOrderStatus,
} from '@/features/super-admin/orders/adminOrderStatus';
import {
  deliveryModeLabel,
  fulfillmentAdvanceLabel,
  getFulfillmentUi,
  isDeliveryModeUnconfirmed,
  shouldConfirmDeliveryMode,
  nextFulfillmentStatus,
  resolveFulfillmentStatus,
  DELIVERY_MODE_UNCONFIRMED_MESSAGE,
  type FulfillmentStatus,
} from '@/constants/Config';
import {
  extractOrderItemsArray,
  formatAdminCurrency,
  formatAdminOrderDate,
  getCleanProductImageUrl,
  normalizeShippingFromOrder,
} from '@/features/super-admin/orders/orderUtils';
import {
  isOrderPaymentConfirmed,
  orderStatusImpliesPaymentMismatch,
} from '@/features/super-admin/orders/orderPayment';
import { openPhoneDialer, openSmsComposer } from '@/features/super-admin/orders/contactChannels';
import { resolveOrderShippingMethod, shippingMethodIcon } from '@/utils/orderShipping';
import {
  formatVariantQuantityLine,
  getOrderItemVariantLines,
  getOrderLineStableKey,
  hasVisibleVariantAttrs,
} from '@/utils/orderItemVariants';

function pickStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

function formatSupplierItemsList(items: Array<Record<string, unknown> | { name?: string }>): string {
  return items
    .flatMap((item) => {
      const rec = item as Record<string, unknown>;
      const name = String(rec.name || "Produit");
      return getOrderItemVariantLines(rec).map((line) =>
        `• ${formatVariantQuantityLine(name, line)}`,
      );
    })
    .join("\n");
}

interface Order {
  id: string;
  orderId: string;
  status: AdminOrderStatus;
  fulfillmentStatus?: FulfillmentStatus;
  deliveryMode?: string;
  currency: string;
  total: number;
  createdAt: Timestamp;
  /** Client Firebase (pour lien vers ses commandes). */
  userId?: string;
  customerEmail?: string;
  items: Array<{
    name: string;
    imageUrl?: string;
    image?: string;
    photoURL?: string;
    photos?: string[];
    quantity: number;
    price: number;
    companyName: string;
    companyPhone?: string;
    companyId?: string;
    productId?: string;
    seller?: string;
    sellerId?: string;
    supplier?: string;
    id?: string;
    sku?: string;
    hasFreeShipping?: boolean;
    specifications?: {
      volume?: string;
      weight?: string;
      [key: string]: any;
    };
    color?: string;
    size?: string;
    selectedColor?: string;
    selectedSize?: string;
    variantLines?: Array<{ color?: string | null; size?: string | null; quantity: number }>;
  }>;
  shippingAddress: {
    fullName: string;
    phone: string;
    street: string;
    city: string;
    postalCode?: string;
    country: string;
    apartment?: string;
    building?: string;
    floor?: string;
    deliveryNote?: string;
  };
  shippingMethod?: string;
  shippingMethodName?: string;
  shippingMethodDelay?: string;
  shippingEstimatedDays?: string;
  shippingMethodType?: string;
  shipping?: {
    method?: string;
    details?: string;
    option?: { name?: string; deliveryTime?: string; type?: string; id?: string };
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
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const isOperationalStaff = isSuperAdmin || isAdmin;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [targetPhone, setTargetPhone] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<{name: string, company: string, phone?: string} | null>(null);
  const [notifiedSuppliers, setNotifiedSuppliers] = useState<Set<string>>(new Set());
  const [productInfoVisible, setProductInfoVisible] = useState(false);
  const [productInfoLine, setProductInfoLine] = useState<Order["items"][number] | null>(null);
  const [productInfoDoc, setProductInfoDoc] = useState<Record<string, unknown> | null>(null);
  const [productInfoLoading, setProductInfoLoading] = useState(false);

  useEffect(() => {
    if (!user || !isOperationalStaff) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetchOrder();
  }, [id, user, isOperationalStaff]);

  useEffect(() => {
    if (!user) {
      router.replace('/(tabs)/account');
      return;
    }
    if (!isOperationalStaff) {
      Alert.alert('Accès refusé', 'Réservé aux administrateurs.');
      router.back();
    }
  }, [user, isOperationalStaff]);

  const fetchOrder = async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      const orderDoc = await getDoc(doc(db, 'orders', id));
      if (orderDoc.exists()) {
        const raw = orderDoc.data() as Record<string, unknown>;
        const persisted = raw.notifiedSupplierCompanies;
        if (Array.isArray(persisted)) {
          setNotifiedSuppliers(
            new Set(
              persisted.filter((x): x is string => typeof x === "string"),
            ),
          );
        } else {
          setNotifiedSuppliers(new Set());
        }
        const mergedItems = extractOrderItemsArray(raw);
        const ship = normalizeShippingFromOrder(raw);
        const prevShip = (raw.shippingAddress || {}) as Record<string, unknown>;
        setOrder({
          id: orderDoc.id,
          ...raw,
          userId: typeof raw.userId === "string" ? raw.userId : undefined,
          customerEmail:
            typeof raw.customerEmail === "string"
              ? raw.customerEmail
              : typeof raw.userEmail === "string"
                ? raw.userEmail
                : undefined,
          status: normalizeAdminOrderStatus(raw.status),
          fulfillmentStatus: resolveFulfillmentStatus(raw),
          items:
            (mergedItems.length
              ? mergedItems
              : Array.isArray(raw.items)
                ? raw.items
                : []) as Order["items"],
          shippingAddress: {
            fullName: String(
              ship.fullName ?? prevShip.fullName ?? "",
            ),
            phone: String(ship.phone ?? prevShip.phone ?? ""),
            street: String(ship.street ?? prevShip.street ?? ""),
            city: String(ship.city ?? prevShip.city ?? ""),
            postalCode: String(ship.postalCode ?? prevShip.postalCode ?? ""),
            country: String(ship.country ?? prevShip.country ?? ""),
            apartment: String(
              ship.apartment ?? prevShip.apartment ?? "",
            ),
            building: String(ship.building ?? prevShip.building ?? ""),
            floor: String(ship.floor ?? prevShip.floor ?? ""),
            deliveryNote: String(
              ship.deliveryNote ?? prevShip.deliveryNote ?? "",
            ),
          },
        } as Order);
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

  const openProductInfo = async (item: Order["items"][number]) => {
    setProductInfoLine(item);
    setProductInfoDoc(null);
    setProductInfoVisible(true);
    const line = item as Record<string, unknown>;
    const pid =
      typeof line.productId === "string" && line.productId.trim()
        ? line.productId.trim()
        : "";
    if (!pid) {
      return;
    }
    setProductInfoLoading(true);
    try {
      const snap = await getDoc(doc(db, "products", pid));
      if (snap.exists()) {
        setProductInfoDoc(snap.data() as Record<string, unknown>);
      }
    } catch (e) {
      console.warn("[super-admin/order] lecture produit", e);
    } finally {
      setProductInfoLoading(false);
    }
  };

  const closeProductInfo = () => {
    setProductInfoVisible(false);
    setProductInfoLine(null);
    setProductInfoDoc(null);
  };

  const updateFulfillment = async (newStatus: FulfillmentStatus) => {
    if (!order || updating) return;
    const rec = order as unknown as Record<string, unknown>;
    if (!isOrderPaymentConfirmed(rec)) {
      Alert.alert(
        "Paiement non confirmé",
        "Impossible d’avancer cette commande : aucun paiement enregistré (pas de date paidAt ni statut de paiement valide). Les commandes de test ne doivent pas être traitées ni livrées.",
      );
      return;
    }

    Alert.alert(
      'Confirmer le changement',
      `Passer le suivi logistique à « ${getFulfillmentUi(newStatus).label} » ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setUpdating(true);
            try {
              await updateDoc(doc(db, 'orders', order.id), { 
                fulfillmentStatus: newStatus, 
                updatedAt: Timestamp.now() 
              });
              setOrder({ ...order, fulfillmentStatus: newStatus });
              Alert.alert('Succès', 'Suivi logistique mis à jour');
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
      const itemsList = formatSupplierItemsList(supplier.items);
      
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
      const itemsList = formatSupplierItemsList(supplier.items);
      
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
      `🏭 ${s.company} :\n${formatSupplierItemsList(s.items).replace(/^• /gm, "  • ")}`
    ).join('\n\n');

    Alert.alert(
      'Notifier tous les fournisseurs',
      'Copiez le récapitulatif pour l’envoyer par SMS ou e-mail à chaque boutique.',
      [
        {
          text: 'Copier la liste',
          onPress: () => {
            Clipboard.setString(groupsMessage);
            Alert.alert('✅ Copié', 'Liste des fournisseurs copiée dans le presse-papiers.');
          }
        },
        { text: 'Fermer', style: 'cancel' }
      ]
    );
  };

  const markSupplierNotified = (companyName: string) => {
    setNotifiedSuppliers((prev) => {
      const newSet = new Set(prev);
      newSet.add(companyName);
      return newSet;
    });
  };

  const persistSupplierNotifiedToOrder = async (companyName: string) => {
    if (!id || !companyName.trim()) return;
    try {
      await updateDoc(doc(db, "orders", String(id)), {
        notifiedSupplierCompanies: arrayUnion(companyName.trim()),
        supplierNotifyUpdatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn("[super-admin/order] persist notify:", e);
    }
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

  const fulfillment = resolveFulfillmentStatus(order);
  const statusInfo = fulfillment
    ? getFulfillmentUi(fulfillment)
    : getAdminStatusUi(order.status);
  const orderRec = order as unknown as Record<string, unknown>;
  const paymentOk = isOrderPaymentConfirmed(orderRec);
  const paymentMismatch = orderStatusImpliesPaymentMismatch(
    String(order.status),
    orderRec,
  );
  const nextFulfillment = nextFulfillmentStatus(fulfillment, order.deliveryMode);
  const canShowAdvance =
    Boolean(nextFulfillment) &&
    paymentOk &&
    order.status !== "cancelled" &&
    order.status !== "failed";

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
            {!isDeliveryModeUnconfirmed(order.deliveryMode) && deliveryModeLabel(order.deliveryMode)
              ? ` · ${deliveryModeLabel(order.deliveryMode)}`
              : ''}
          </Text>
          <Text style={styles.dateText}>{formatAdminOrderDate(order.createdAt)}</Text>
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

        {shouldConfirmDeliveryMode(order) && (
          <View style={styles.paymentMismatch}>
            <Ionicons name="alert-circle-outline" size={22} color="#B45309" />
            <Text style={styles.paymentMismatchText}>
              {DELIVERY_MODE_UNCONFIRMED_MESSAGE}
            </Text>
          </View>
        )}

        {paymentMismatch ? (
          <View style={styles.paymentMismatch}>
            <Ionicons name="warning-outline" size={22} color="#B45309" />
            <Text style={styles.paymentMismatchText}>
              Incohérence : le statut est avancé (confirmé, expédié, livré…) alors
              qu’aucun paiement n’est enregistré (paidAt / paymentStatus). Ne pas
              traiter comme une vente réelle ; corrigez en base ou annulez.
            </Text>
          </View>
        ) : !paymentOk ? (
          <View style={styles.paymentWarn}>
            <Ionicons name="card-outline" size={22} color="#B91C1C" />
            <Text style={styles.paymentWarnText}>
              Paiement non confirmé : ne prévenez pas les fournisseurs et n’avancez
              pas le statut tant que la passerelle n’a pas enregistré un paiement
              (paidAt ou paymentStatus).
            </Text>
          </View>
        ) : null}

        <View style={styles.marketplaceHint}>
          <Ionicons name="git-network-outline" size={22} color="#C2410C" />
          <Text style={styles.marketplaceHintText}>
            Logique marketplace : le client paie sur A2Express ; vous relayez chaque
            ligne vers la boutique concernée (appel ou SMS professionnel), comme un
            agrégateur type Alibaba.
          </Text>
        </View>

        {/* Bouton de notification groupée pour les fournisseurs */}
        <View style={styles.bulkActionContainer}>
            <TouchableOpacity 
            style={[styles.bulkNotifyButton, !paymentOk && styles.bulkNotifyDisabled]}
            onPress={() => {
              if (!paymentOk) {
                Alert.alert(
                  "Paiement requis",
                  "Confirmez d’abord le paiement avant de contacter les fournisseurs.",
                );
                return;
              }
              notifyAllSuppliers();
            }}
          >
            <Ionicons name="megaphone-outline" size={22} color="#FFF" />
            <Text style={styles.bulkNotifyText}>
              Contacter les fournisseurs (appel / SMS)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Liste des produits avec variantes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📦 Articles à préparer</Text>
          {order.items?.map((item, index) => {
            const imageUrl = getCleanProductImageUrl(item as Record<string, unknown>);
            const isNotified = notifiedSuppliers.has(item.companyName);
            const variantLines = getOrderItemVariantLines(item as Record<string, unknown>);
            const grouped = variantLines.length > 1;
            
            return (
              <View key={getOrderLineStableKey(item as Record<string, unknown>, index)} style={styles.productCard}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => openProductInfo(item)}
                  style={styles.productImageTouchable}
                  accessibilityRole="button"
                  accessibilityLabel="Voir le détail du produit et la boutique"
                >
                  <Image
                    source={imageUrl ? { uri: imageUrl } : null}
                    style={styles.productImage}
                    contentFit="cover"
                    transition={300}
                    cachePolicy="disk"
                    placeholder={null}
                    recyclingKey={imageUrl}
                  />
                </TouchableOpacity>
                
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
                  </View>

                  {hasVisibleVariantAttrs(variantLines)
                    ? variantLines.map((line, lineIndex) => (
                    <Text
                      key={`${line.color}-${line.size}-${lineIndex}`}
                      style={styles.variantLineText}
                    >
                      {formatVariantQuantityLine(String(item.name || "Produit"), line, {
                        includeName: !grouped,
                      })}
                    </Text>
                      ))
                    : null}

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
                        const itemsList = supplierItems
                          .flatMap((i) => {
                            const name = String(i.name || "Produit");
                            const lines = getOrderItemVariantLines(i as Record<string, unknown>);
                            return lines.map((line) =>
                              `• ${formatVariantQuantityLine(name, line)}`,
                            );
                          })
                          .join('\n');
                        
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
                      <Ionicons 
                        name={isNotified ? "checkmark-circle" : "chatbubble-ellipses-outline"} 
                        size={16} 
                        color={isNotified ? "#10B981" : "#EA580C"} 
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
                {formatAdminCurrency(order.summary?.subtotal || order.total, order.currency)}
              </Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Frais de livraison</Text>
              <Text style={styles.summaryValue}>
                {formatAdminCurrency(order.summary?.shipping || 0, order.currency)}
              </Text>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL À ENCAISSER</Text>
              <Text style={styles.totalValue}>
                {formatAdminCurrency(order.total, order.currency)}
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
                  onPress={() => openPhoneDialer(order.shippingAddress?.phone || "")}
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
                {(!!order.shippingAddress?.building ||
                  !!order.shippingAddress?.floor ||
                  !!order.shippingAddress?.apartment) && (
                  <Text style={styles.addressLine}>
                    {[
                      order.shippingAddress?.building
                        ? `Bâtiment : ${order.shippingAddress.building}`
                        : null,
                      order.shippingAddress?.floor
                        ? `Étage : ${order.shippingAddress.floor}`
                        : null,
                      order.shippingAddress?.apartment
                        ? `Appt : ${order.shippingAddress.apartment}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </Text>
                )}
                <Text style={styles.addressLine}>
                  {order.shippingAddress?.postalCode} {order.shippingAddress?.city}
                </Text>
                <Text style={styles.addressLine}>{order.shippingAddress?.country}</Text>
                {!!order.shippingAddress?.deliveryNote && (
                  <Text style={styles.addressLine}>
                    Note livreur : {order.shippingAddress.deliveryNote}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.divider} />

            {(() => {
              const transport = resolveOrderShippingMethod(order as unknown as Record<string, unknown>);
              return (
                <View style={styles.addressContainer}>
                  <Ionicons name="airplane-outline" size={20} color="#FF6B00" />
                  <View style={styles.addressTextContainer}>
                    <Text style={styles.addressLine}>
                      Mode de transport : {shippingMethodIcon(transport.type)} {transport.name}
                    </Text>
                  </View>
                </View>
              );
            })()}
          </View>
        </View>

        {/* Espace supplémentaire pour le footer fixe */}
        <View style={styles.footerSpacer} />
      </ScrollView>

      {/* Footer avec actions principales - fixé en bas avec SafeAreaView */}
      <SafeAreaView style={styles.footer} edges={['bottom']}>
        <View style={styles.footerContent}>
          <TouchableOpacity 
            style={[styles.contactButton, { borderColor: '#3B82F6' }]} 
            onPress={() => openPhoneDialer(order.shippingAddress?.phone || "")}
          >
            <Ionicons name="call" size={22} color="#3B82F6" />
          </TouchableOpacity>
          
          {canShowAdvance && nextFulfillment ? (
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: statusInfo.color }]}
              onPress={() => updateFulfillment(nextFulfillment)}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.actionButtonText}>
                    {fulfillmentAdvanceLabel(fulfillment, nextFulfillment)}
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFF" />
                </>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>

      {/* Modal : appel / SMS / copie (pas WhatsApp) */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  Contacter le fournisseur
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
              placeholder="Numéro (ex: +223…)" 
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
              placeholder="Message (SMS ou à dicter au téléphone)…"
              placeholderTextColor="#999"
              textAlignVertical="top"
            />
            
            <View style={styles.modalActionsRow}>
              <TouchableOpacity 
                style={[styles.modalActionBtn, styles.modalCallBtn]} 
                onPress={() => {
                  if (!targetPhone) {
                    Alert.alert("Numéro manquant", "Indiquez un numéro.");
                    return;
                  }
                  openPhoneDialer(targetPhone);
                }}
              >
                <Ionicons name="call" size={20} color="#FFF" />
                <Text style={styles.modalActionBtnText}>Appeler</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalActionBtn, styles.modalSmsBtn]} 
                onPress={() => {
                  if (!targetPhone) {
                    Alert.alert("Numéro manquant", "Indiquez un numéro.");
                    return;
                  }
                  openSmsComposer(targetPhone, message);
                  if (selectedSupplier?.company) {
                    markSupplierNotified(selectedSupplier.company);
                    void persistSupplierNotifiedToOrder(selectedSupplier.company);
                  }
                  setModalVisible(false);
                }}
              >
                <Ionicons name="chatbubble-outline" size={20} color="#FFF" />
                <Text style={styles.modalActionBtnText}>SMS</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.copyButton} 
              onPress={() => {
                Clipboard.setString(message);
                Alert.alert("Copié", "Message copié dans le presse-papiers.");
              }}
            >
              <Ionicons name="copy-outline" size={20} color="#374151" />
              <Text style={styles.copyButtonText}>Copier le texte</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={productInfoVisible}
        transparent
        animationType="slide"
        onRequestClose={closeProductInfo}
      >
        <View style={styles.productDetailOverlay}>
          <TouchableOpacity
            style={styles.productDetailBackdrop}
            activeOpacity={1}
            onPress={closeProductInfo}
          />
          <View style={styles.productDetailSheet}>
            <View style={styles.productDetailHeader}>
              <Text style={styles.productDetailTitle}>Produit & boutique</Text>
              <TouchableOpacity onPress={closeProductInfo} hitSlop={12}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            {productInfoLoading ? (
              <View style={styles.productDetailLoading}>
                <ActivityIndicator color="#EA580C" />
                <Text style={styles.productDetailLoadingText}>Chargement fiche produit…</Text>
              </View>
            ) : null}
            {productInfoLine ? (
              <ScrollView
                style={styles.productDetailScroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {(() => {
                  const line = productInfoLine as Record<string, unknown>;
                  const doc = productInfoDoc;
                  const img = getCleanProductImageUrl(line);
                  const productId = pickStr(line.productId);
                  const lineCompanyId = pickStr(line.companyId);
                  const docCompanyId = pickStr(doc?.companyId);
                  const docSellerId = pickStr(doc?.sellerId);
                  const companyId = lineCompanyId || docCompanyId || docSellerId;
                  const boutiqueName =
                    pickStr(line.companyName) ||
                    pickStr(doc?.companyName) ||
                    pickStr(doc?.supplier);
                  const boutiquePhone =
                    pickStr(line.companyPhone) ||
                    pickStr(doc?.companyPhone) ||
                    pickStr(doc?.phone);
                  const seller =
                    pickStr(line.seller) ||
                    pickStr(line.supplier) ||
                    pickStr(doc?.supplier);
                  const unit = Number(line.price) || 0;
                  const qty = Number(line.quantity) || 0;
                  const lineTotal = unit * qty;
                  const desc =
                    pickStr(doc?.description) ||
                    pickStr(doc?.longDescription) ||
                    pickStr(doc?.shortDescription);

                  const variantLines = getOrderItemVariantLines(line);
                  const productName = pickStr(line.name) || "Produit";

                  return (
                    <>
                      {img ? (
                        <Image
                          source={{ uri: img }}
                          style={styles.productDetailHero}
                          contentFit="contain"
                          cachePolicy="disk"
                        />
                      ) : null}

                      <Text style={styles.productDetailName}>
                        {productName}
                      </Text>

                      {variantLines.map((variant, variantIndex) => (
                        <Text
                          key={`${variant.color}-${variant.size}-${variantIndex}`}
                          style={styles.productDetailPriceLine}
                        >
                          {formatVariantQuantityLine(productName, variant, {
                            includeName: variantLines.length === 1,
                          })}
                        </Text>
                      ))}

                      <View style={styles.productDetailPrices}>
                        <Text style={styles.productDetailPriceLine}>
                          Prix unitaire :{" "}
                          {formatAdminCurrency(unit, order.currency)}
                        </Text>
                        <Text style={styles.productDetailPriceLine}>
                          Quantité : {qty}
                        </Text>
                        <Text style={styles.productDetailTotal}>
                          Sous-total ligne :{" "}
                          {formatAdminCurrency(lineTotal, order.currency)}
                        </Text>
                      </View>

                      <Text style={styles.productDetailSection}>Boutique / usine</Text>
                      {boutiqueName ? (
                        <View style={styles.kvRow}>
                          <Text style={styles.kvLabel}>Nom</Text>
                          <Text style={styles.kvValue}>{boutiqueName}</Text>
                        </View>
                      ) : null}
                      {boutiquePhone ? (
                        <TouchableOpacity
                          style={styles.kvRow}
                          onPress={() => openPhoneDialer(boutiquePhone)}
                        >
                          <Text style={styles.kvLabel}>Téléphone</Text>
                          <Text style={[styles.kvValue, styles.kvLink]}>
                            {boutiquePhone}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      {seller && seller !== boutiqueName ? (
                        <View style={styles.kvRow}>
                          <Text style={styles.kvLabel}>Vendeur / fournisseur</Text>
                          <Text style={styles.kvValue}>{seller}</Text>
                        </View>
                      ) : null}
                      {companyId ? (
                        <View style={styles.kvRow}>
                          <Text style={styles.kvLabel}>ID entreprise (Firestore)</Text>
                          <Text style={styles.kvValue} selectable>
                            {companyId}
                          </Text>
                        </View>
                      ) : null}
                      {productId ? (
                        <View style={styles.kvRow}>
                          <Text style={styles.kvLabel}>ID produit</Text>
                          <Text style={styles.kvValue} selectable>
                            {productId}
                          </Text>
                        </View>
                      ) : null}

                      {desc ? (
                        <>
                          <Text style={styles.productDetailSection}>Description</Text>
                          <Text style={styles.productDetailDesc}>{desc}</Text>
                        </>
                      ) : null}

                      {productInfoLine.specifications &&
                      Object.keys(productInfoLine.specifications).length > 0 ? (
                        <>
                          <Text style={styles.productDetailSection}>Spécifications</Text>
                          <Text style={styles.productDetailMono}>
                            {JSON.stringify(productInfoLine.specifications, null, 2)}
                          </Text>
                        </>
                      ) : null}

                      <View style={styles.productDetailActions}>
                        {productId ? (
                          <TouchableOpacity
                            style={styles.productDetailBtn}
                            onPress={() => {
                              closeProductInfo();
                              router.push(`/product/${productId}`);
                            }}
                          >
                            <Ionicons name="open-outline" size={18} color="#FFF" />
                            <Text style={styles.productDetailBtnText}>
                              Fiche produit
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                        {companyId ? (
                          <TouchableOpacity
                            style={[styles.productDetailBtn, styles.productDetailBtnOutline]}
                            onPress={() => {
                              closeProductInfo();
                              router.push(`/company/${companyId}`);
                            }}
                          >
                            <Ionicons name="storefront-outline" size={18} color="#EA580C" />
                            <Text
                              style={[
                                styles.productDetailBtnText,
                                styles.productDetailBtnTextOutline,
                              ]}
                            >
                              Page boutique
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                        {order.userId ? (
                          <TouchableOpacity
                            style={[styles.productDetailBtn, styles.productDetailBtnSecondary]}
                            onPress={() => {
                              closeProductInfo();
                              router.push(
                                `/super-admin/orders?userId=${encodeURIComponent(order.userId!)}`,
                              );
                            }}
                          >
                            <Ionicons name="receipt-outline" size={18} color="#FFF" />
                            <Text style={styles.productDetailBtnText}>
                              Commandes de ce client
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.productDetailHint}>
                            ID client absent sur la commande — impossible de filtrer ses
                            commandes.
                          </Text>
                        )}
                      </View>
                    </>
                  );
                })()}
              </ScrollView>
            ) : null}
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
  marketplaceHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  marketplaceHintText: {
    flex: 1,
    fontSize: 13,
    color: '#7C2D12',
    lineHeight: 19,
    fontWeight: '500',
  },
  paymentWarn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  paymentWarnText: {
    flex: 1,
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 19,
    fontWeight: '600',
  },
  paymentMismatch: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  paymentMismatchText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 19,
    fontWeight: '600',
  },
  bulkActionContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  bulkNotifyButton: {
    backgroundColor: '#EA580C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
  },
  bulkNotifyDisabled: {
    opacity: 0.45,
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
  productImageTouchable: {
    borderRadius: 12,
    overflow: "hidden",
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
  variantLineText: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 2,
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
    marginBottom: 16,
    fontSize: 15,
    color: '#111',
    height: 120,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  modalActionBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  modalCallBtn: {
    backgroundColor: '#2563EB',
  },
  modalSmsBtn: {
    backgroundColor: '#EA580C',
  },
  modalActionBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
  copyButton: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
  },
  copyButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 15,
  },
  productDetailOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  productDetailBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  productDetailSheet: {
    maxHeight: "88%",
    backgroundColor: "#FFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  productDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  productDetailTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111",
  },
  productDetailScroll: {
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  productDetailLoading: {
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  productDetailLoadingText: {
    fontSize: 13,
    color: "#6B7280",
  },
  productDetailHero: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    marginBottom: 12,
  },
  productDetailName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111",
    marginBottom: 10,
  },
  productDetailPrices: {
    marginBottom: 16,
    gap: 4,
  },
  productDetailPriceLine: {
    fontSize: 14,
    color: "#4B5563",
  },
  productDetailTotal: {
    fontSize: 15,
    fontWeight: "800",
    color: "#EA580C",
    marginTop: 4,
  },
  productDetailSection: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111",
    marginTop: 14,
    marginBottom: 8,
  },
  kvRow: {
    marginBottom: 10,
  },
  kvLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  kvValue: {
    fontSize: 15,
    color: "#1F2937",
    fontWeight: "600",
  },
  kvLink: {
    color: "#2563EB",
  },
  productDetailDesc: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 21,
  },
  productDetailMono: {
    fontSize: 12,
    color: "#374151",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    backgroundColor: "#F9FAFB",
    padding: 10,
    borderRadius: 8,
  },
  productDetailActions: {
    marginTop: 20,
    marginBottom: 20,
    gap: 10,
  },
  productDetailBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#EA580C",
    paddingVertical: 14,
    borderRadius: 12,
  },
  productDetailBtnOutline: {
    backgroundColor: "#FFF",
    borderWidth: 2,
    borderColor: "#EA580C",
  },
  productDetailBtnSecondary: {
    backgroundColor: "#1D4ED8",
  },
  productDetailBtnText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 15,
  },
  productDetailBtnTextOutline: {
    color: "#EA580C",
  },
  productDetailHint: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 4,
  },
});