// apps/mobile/app/chat/[id].tsx - VERSION CORRIGÉE SANS DEPENDANCE EXTERNE
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
  ScrollView,
  Share,
  Linking
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { db, auth, storage } from '@/config/firebase';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

export default function ChatScreen() {
  const { id: conversationId, title } = useLocalSearchParams();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [user, setUser] = useState(null);
  const [inputText, setInputText] = useState('');
  const [showActions, setShowActions] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showOrderActions, setShowOrderActions] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [offline, setOffline] = useState(false);
  const [products, setProducts] = useState([]);

  // Charger l'utilisateur
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        loadConversation(currentUser.uid);
        loadMessages(currentUser.uid);
        loadRelevantProducts();
      }
    });
    return unsubscribe;
  }, [conversationId]);

  // Charger la conversation
  const loadConversation = async (userId) => {
    try {
      const convRef = doc(db, 'conversations', conversationId);
      const unsubscribe = onSnapshot(convRef, (docSnap) => {
        if (docSnap.exists()) {
          const convData = { id: docSnap.id, ...docSnap.data() };
          setConversation(convData);
          
          // Marquer comme lu
          if (convData.unreadCount?.[userId] > 0) {
            updateDoc(convRef, {
              [`unreadCount.${userId}`]: 0
            });
          }
        } else {
          Alert.alert('Erreur', 'Conversation introuvable');
          router.back();
        }
        setLoading(false);
      });
      return unsubscribe;
    } catch (error) {
      console.error('Error loading conversation:', error);
      setLoading(false);
    }
  };

  // Charger les messages
  const loadMessages = (userId) => {
    try {
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const q = query(
        messagesRef,
        orderBy('createdAt', 'asc'), // Changé de 'desc' à 'asc' pour afficher du plus ancien au plus récent
        limit(100)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgList = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          msgList.push({
            id: docSnap.id, // Changé de _id à id
            text: data.text,
            createdAt: data.createdAt?.toDate(),
            senderId: data.senderId, // Ajouté pour faciliter la comparaison
            senderName: data.senderName,
            senderAvatar: data.senderAvatar,
            type: data.type || 'text',
            metadata: data.metadata,
            readBy: data.readBy || [],
            system: data.type === 'system'
          });
        });
        setMessages(msgList);
        
        // Marquer les messages comme lus
        const unreadMessages = msgList.filter(msg => 
          msg.senderId !== userId && 
          !msg.readBy?.includes(userId)
        );
        
        if (unreadMessages.length > 0) {
          markMessagesAsRead(unreadMessages.map(m => m.id), userId);
        }

        // Scroll vers le bas après chargement
        setTimeout(() => {
          if (flatListRef.current && msgList.length > 0) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }, 100);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  // Charger les produits pertinents
  const loadRelevantProducts = async () => {
    try {
      // Basé sur le type de conversation
      if (conversation?.metadata?.productId) {
        // Charger le produit spécifique
        const productRef = doc(db, 'products', conversation.metadata.productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          setProducts([{ id: productSnap.id, ...productSnap.data() }]);
        }
      } else if (conversation?.partnerData?.companyId) {
        // Charger les produits du partenaire
        const productsRef = collection(db, 'products');
        const q = query(
          productsRef,
          where('companyId', '==', conversation.partnerData.companyId),
          limit(10)
        );
        
        const snapshot = await getDocs(q);
        const productList = [];
        snapshot.forEach((docSnap) => {
          productList.push({
            id: docSnap.id,
            ...docSnap.data()
          });
        });
        setProducts(productList);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  // Envoyer un message
  const sendMessage = async (text, type = 'text', metadata = {}) => {
    if (!text.trim() || !user || sending) return;

    setSending(true);
    try {
      const messageData = {
        conversationId,
        text: text.trim(),
        senderId: user.uid,
        senderName: user.displayName || user.email || 'Client',
        senderAvatar: user.photoURL || '👤',
        type,
        metadata,
        readBy: [user.uid],
        createdAt: serverTimestamp()
      };

      // Ajouter le message
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      await addDoc(messagesRef, messageData);

      // Mettre à jour la conversation
      const convRef = doc(db, 'conversations', conversationId);
      await updateDoc(convRef, {
        lastMessage: text.trim(),
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...Object.keys(conversation?.unreadCount || {}).reduce((acc, participantId) => {
          if (participantId !== user.uid) {
            acc[`unreadCount.${participantId}`] = (conversation.unreadCount[participantId] || 0) + 1;
          }
          return acc;
        }, {})
      });

      setInputText('');
      
      // Scroll vers le bas
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer le message');
    } finally {
      setSending(false);
    }
  };

  // Envoyer une image
  const sendImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à la bibliothèque');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3]
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        
        // Upload l'image
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const imageName = `chat_images/${conversationId}/${Date.now()}.jpg`;
        const imageRef = ref(storage, imageName);
        
        await uploadBytes(imageRef, blob);
        const downloadURL = await getDownloadURL(imageRef);
        
        // Envoyer le message
        sendMessage('📷 Image envoyée', 'image', { imageUrl: downloadURL });
      }
    } catch (error) {
      console.error('Error sending image:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer l\'image');
    }
  };

  // Envoyer un produit
  const sendProduct = (product) => {
    const message = `🛍️ ${product.name}\n💰 ${product.price}€`;
    sendMessage(message, 'product', {
      productId: product.id,
      productImage: product.images?.[0],
      productName: product.name,
      price: product.price,
      currency: product.currency || '€'
    });
    setShowProductModal(false);
  };

  // Envoyer une offre
  const sendOffer = () => {
    Alert.prompt(
      'Faire une offre',
      'Entrez le montant de votre offre :',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Envoyer', 
          onPress: (amount) => {
            if (amount && !isNaN(parseFloat(amount))) {
              sendMessage(`💰 Offre de ${amount}€`, 'offer', {
                offerAmount: amount,
                currency: '€'
              });
            }
          }
        }
      ],
      'plain-text',
      '',
      'numeric'
    );
  };

  // Marquer les messages comme lus
  const markMessagesAsRead = async (messageIds, userId) => {
    try {
      const batch = [];
      messageIds.forEach(messageId => {
        const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
        batch.push(updateDoc(messageRef, {
          readBy: arrayUnion(userId)
        }));
      });
      await Promise.all(batch);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // Actions de commande
  const showOrderActionsSheet = () => {
    const actions = [
      {
        text: 'Voir le statut',
        icon: '📊',
        onPress: () => {
          // Naviguer vers la commande
          if (conversation?.orderData?.orderId) {
            router.push(`/orders/${conversation.orderData.orderId}`);
          }
        }
      },
      {
        text: 'Suivre la livraison',
        icon: '🚚',
        onPress: () => {
          if (conversation?.orderData?.trackingNumber) {
            const url = `https://tracking.com/${conversation.orderData.trackingNumber}`;
            Linking.openURL(url);
          } else {
            sendMessage('Quel est le numéro de suivi de ma commande ?');
          }
        }
      },
      {
        text: 'Annuler la commande',
        icon: '❌',
        onPress: () => {
          Alert.alert(
            'Annuler la commande',
            'Êtes-vous sûr de vouloir annuler cette commande ?',
            [
              { text: 'Non', style: 'cancel' },
              { 
                text: 'Oui', 
                onPress: () => {
                  sendMessage('Je souhaite annuler ma commande', 'order_update', {
                    action: 'cancel_request'
                  });
                }
              }
            ]
          );
        },
        destructive: true
      }
    ];

    Alert.alert(
      'Actions de commande',
      undefined,
      actions.map(action => ({
        text: action.text,
        onPress: action.onPress,
        style: action.destructive ? 'destructive' : 'default'
      })),
      { cancelable: true }
    );
  };

  // Fonctions supplémentaires
  const shareConversation = async () => {
    try {
      await Share.share({
        message: `Conversation: ${conversation?.title}`,
        url: `https://yourapp.com/chat/${conversationId}`
      });
    } catch (error) {
      console.error('Error sharing conversation:', error);
    }
  };

  const reportConversation = () => {
    Alert.alert('Signaler', 'Cette conversation a été signalée.');
  };

  const deleteConversation = () => {
    Alert.alert(
      'Supprimer la conversation',
      'Êtes-vous sûr de vouloir supprimer cette conversation ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Supprimer', 
          style: 'destructive',
          onPress: () => {
            // Implémentez la suppression ici
            Alert.alert('Succès', 'Conversation supprimée');
            router.back();
          }
        }
      ]
    );
  };

  // RENDER FUNCTIONS SANS GiftedChat

  const renderSystemMessage = (message) => (
    <View style={styles.systemMessage}>
      <Text style={styles.systemMessageText}>{message.text}</Text>
      <Text style={styles.systemMessageTime}>
        {message.createdAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  const renderProductMessage = (message) => {
    const isMyMessage = message.senderId === user?.uid;
    
    return (
      <View style={[
        styles.productMessage,
        isMyMessage ? styles.myProductMessage : styles.theirProductMessage
      ]}>
        <Image 
          source={{ uri: message.metadata?.productImage || 'https://via.placeholder.com/100' }}
          style={styles.productImage}
        />
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{message.metadata?.productName}</Text>
          <Text style={styles.productPrice}>{message.metadata?.price}</Text>
          <TouchableOpacity 
            style={styles.productButton}
            onPress={() => setSelectedProduct(message.metadata)}
          >
            <Text style={styles.productButtonText}>Voir le produit</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.productTime}>
          {message.createdAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  const renderImageMessage = (message) => {
    const isMyMessage = message.senderId === user?.uid;
    
    return (
      <View style={[
        styles.imageMessage,
        isMyMessage ? styles.myMessage : styles.theirMessage
      ]}>
        <Image 
          source={{ uri: message.metadata?.imageUrl }}
          style={styles.messageImage}
          resizeMode="cover"
        />
        <Text style={styles.imageTime}>
          {message.createdAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  const renderOrderUpdateMessage = (message) => (
    <View style={styles.orderUpdateMessage}>
      <Ionicons name="cube-outline" size={20} color="#666" style={styles.orderIcon} />
      <View style={styles.orderUpdateContent}>
        <Text style={styles.orderUpdateText}>{message.text}</Text>
        <Text style={styles.orderUpdateTime}>
          {message.createdAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );

  const renderTextMessage = (message) => {
    const isMyMessage = message.senderId === user?.uid;
    
    return (
      <View style={[
        styles.messageBubble,
        isMyMessage ? styles.myMessageBubble : styles.theirMessageBubble
      ]}>
        {!isMyMessage && (
          <Text style={styles.senderName}>{message.senderName}</Text>
        )}
        <Text style={[
          styles.messageText,
          isMyMessage ? styles.myMessageText : styles.theirMessageText
        ]}>
          {message.text}
        </Text>
        <Text style={[
          styles.messageTime,
          isMyMessage ? styles.myMessageTime : styles.theirMessageTime
        ]}>
          {message.createdAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  const renderMessageItem = ({ item }) => {
    switch (item.type) {
      case 'system':
        return renderSystemMessage(item);
      case 'product':
        return renderProductMessage(item);
      case 'image':
        return renderImageMessage(item);
      case 'order_update':
        return renderOrderUpdateMessage(item);
      default:
        return renderTextMessage(item);
    }
  };

  // Rendu de l'en-tête personnalisée
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Ionicons name="chevron-back" size={24} color="#000" />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.headerInfo}
        onPress={() => {
          if (conversation?.type === 'partner' && conversation.partnerData) {
            router.push(`/partner/${conversation.partnerData.companyId}`);
          }
        }}
      >
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>
            {conversation?.participantAvatars?.[
              conversation.participants?.find(p => p !== user?.uid)
            ] || '👤'}
          </Text>
          {conversation?.partnerData?.online && (
            <View style={styles.headerOnlineDot} />
          )}
        </View>
        
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {conversation?.title || 'Conversation'}
          </Text>
          {conversation?.partnerData ? (
            <View style={styles.partnerStatus}>
              <Text style={styles.partnerCategory}>
                {conversation.partnerData.category}
              </Text>
              <Text style={styles.partnerResponseTime}>
                ⏱️ {conversation.partnerData.responseTime}
              </Text>
            </View>
          ) : conversation?.orderData ? (
            <View style={styles.orderStatusRow}>
              <Text style={styles.orderStatus}>
                Commande #{conversation.orderData.orderNumber}
              </Text>
              <View style={[
                styles.statusDot,
                conversation.orderData.status === 'delivered' && styles.statusDelivered,
                conversation.orderData.status === 'shipped' && styles.statusShipped,
                conversation.orderData.status === 'processing' && styles.statusProcessing,
              ]} />
            </View>
          ) : (
            <Text style={styles.conversationType}>
              {conversation?.type === 'support' ? 'Support client' : 'Message privé'}
            </Text>
          )}
        </View>
      </TouchableOpacity>
      
      <View style={styles.headerActions}>
        {conversation?.type === 'partner' && (
          <TouchableOpacity style={styles.headerActionButton}>
            <Ionicons name="call-outline" size={22} color="#007AFF" />
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={styles.headerActionButton}
          onPress={() => {
            Alert.alert(
              'Options',
              undefined,
              [
                { text: 'Partager la conversation', onPress: shareConversation },
                { text: 'Signaler un problème', onPress: reportConversation },
                { text: 'Supprimer la conversation', style: 'destructive', onPress: deleteConversation },
                { text: 'Annuler', style: 'cancel' }
              ]
            );
          }}
        >
          <Ionicons name="ellipsis-vertical" size={22} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Rendu des actions rapides
  const renderQuickActions = () => {
    if (conversation?.type === 'order') {
      return (
        <TouchableOpacity 
          style={styles.quickActionButton}
          onPress={showOrderActionsSheet}
        >
          <Ionicons name="cube-outline" size={20} color="#007AFF" />
          <Text style={styles.quickActionText}>Commande</Text>
        </TouchableOpacity>
      );
    }

    if (conversation?.type === 'partner') {
      return (
        <View style={styles.quickActionsRow}>
          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={() => setShowProductModal(true)}
          >
            <Ionicons name="cart-outline" size={20} color="#007AFF" />
            <Text style={styles.quickActionText}>Produit</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={sendOffer}
          >
            <Ionicons name="cash-outline" size={20} color="#34C759" />
            <Text style={styles.quickActionText}>Offre</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={sendImage}
          >
            <Ionicons name="image-outline" size={20} color="#5856D6" />
            <Text style={styles.quickActionText}>Photo</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  // Modal produit
  const renderProductModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showProductModal}
      onRequestClose={() => setShowProductModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choisir un produit</Text>
            <TouchableOpacity onPress={() => setShowProductModal(false)}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={products}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.productItem}
                onPress={() => sendProduct(item)}
              >
                <Image 
                  source={{ uri: item.images?.[0] || 'https://via.placeholder.com/60' }}
                  style={styles.productItemImage}
                />
                <View style={styles.productItemInfo}>
                  <Text style={styles.productItemName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.productItemPrice}>{item.price}€</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            )}
            keyExtractor={item => item.id}
            ListEmptyComponent={
              <View style={styles.emptyProducts}>
                <Ionicons name="cart-outline" size={48} color="#E0E0E0" />
                <Text style={styles.emptyProductsText}>Aucun produit disponible</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        
        {/* En-tête personnalisée */}
        {renderHeader()}
        
        {/* Messages */}
        <View style={styles.chatContainer}>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessageItem}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.messagesList}
            onEndReachedThreshold={0.5}
          />
        </View>

        {/* Actions rapides */}
        {renderQuickActions()}

        {/* Zone de saisie */}
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={styles.inputContainer}>
            <TouchableOpacity 
              style={styles.attachButton}
              onPress={() => setShowActions(!showActions)}
            >
              <Ionicons name="add" size={24} color="#007AFF" />
            </TouchableOpacity>
            
            <TextInput
              style={styles.textInput}
              placeholder="Tapez votre message..."
              placeholderTextColor="#999"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
              onSubmitEditing={() => sendMessage(inputText)}
            />
            
            <TouchableOpacity 
              style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
              onPress={() => sendMessage(inputText)}
              disabled={!inputText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons 
                  name="send" 
                  size={20} 
                  color={inputText.trim() ? "#FFFFFF" : "#999"} 
                />
              )}
            </TouchableOpacity>
          </View>

          {/* Actions étendues */}
          {showActions && (
            <View style={styles.extendedActions}>
              <TouchableOpacity style={styles.actionButton} onPress={sendImage}>
                <View style={[styles.actionIcon, { backgroundColor: '#5856D6' }]}>
                  <Ionicons name="image" size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.actionText}>Photo</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionButton}>
                <View style={[styles.actionIcon, { backgroundColor: '#34C759' }]}>
                  <Ionicons name="document" size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.actionText}>Document</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionButton}>
                <View style={[styles.actionIcon, { backgroundColor: '#FF9500' }]}>
                  <Ionicons name="location" size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.actionText}>Localisation</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionButton}>
                <View style={[styles.actionIcon, { backgroundColor: '#FF3B30' }]}>
                  <Ionicons name="videocam" size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.actionText}>Appel vidéo</Text>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>

        {/* Modal produit */}
        {renderProductModal()}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    position: 'relative',
    marginRight: 12,
  },
  headerAvatarText: {
    fontSize: 24,
  },
  headerOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34C759',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  partnerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  partnerCategory: {
    fontSize: 12,
    color: '#666666',
  },
  partnerResponseTime: {
    fontSize: 12,
    color: '#666666',
  },
  orderStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderStatus: {
    fontSize: 12,
    color: '#666666',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#999',
  },
  statusDelivered: { backgroundColor: '#34C759' },
  statusShipped: { backgroundColor: '#007AFF' },
  statusProcessing: { backgroundColor: '#FF9500' },
  conversationType: {
    fontSize: 12,
    color: '#666666',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerActionButton: {
    padding: 4,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  // Message Styles
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginVertical: 8,
  },
  myMessageBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F0F0',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  theirMessageText: {
    color: '#000000',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  theirMessageTime: {
    color: '#999',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  // System Message
  systemMessage: {
    alignSelf: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginVertical: 8,
    maxWidth: '80%',
  },
  systemMessageText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  systemMessageTime: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
    marginTop: 2,
  },
  // Product Message
  productMessage: {
    flexDirection: 'row',
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginVertical: 8,
    alignItems: 'center',
  },
  myProductMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#E3F2FD',
  },
  theirProductMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5F5F5',
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  productButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  productButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  productTime: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    fontSize: 10,
    color: '#999',
  },
  // Image Message
  imageMessage: {
    maxWidth: '70%',
    borderRadius: 16,
    marginVertical: 8,
    overflow: 'hidden',
  },
  myMessage: {
    alignSelf: 'flex-end',
  },
  theirMessage: {
    alignSelf: 'flex-start',
  },
  messageImage: {
    width: 200,
    height: 150,
  },
  imageTime: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
  },
  // Order Update Message
  orderUpdateMessage: {
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: '#FFF7E6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    marginVertical: 8,
    maxWidth: '90%',
    alignItems: 'center',
  },
  orderIcon: {
    marginRight: 12,
  },
  orderUpdateContent: {
    flex: 1,
  },
  orderUpdateText: {
    fontSize: 13,
    color: '#666',
  },
  orderUpdateTime: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
  },
  quickActionButton: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  quickActionText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
  },
  attachButton: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
    color: '#000000',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  sendButtonDisabled: {
    backgroundColor: '#F5F5F5',
  },
  extendedActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionText: {
    fontSize: 12,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.7,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  productItemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 16,
  },
  productItemInfo: {
    flex: 1,
  },
  productItemName: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 4,
  },
  productItemPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  emptyProducts: {
    padding: 40,
    alignItems: 'center',
  },
  emptyProductsText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
    textAlign: 'center',
  },
});
