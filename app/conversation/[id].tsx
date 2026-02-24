import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
  StatusBar,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useMessages } from '../../src/contexts/MessagesContext';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  serverTimestamp,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  addDoc,
} from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: screenWidth } = Dimensions.get('window');

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName?: string;
  timestamp: Date;
  readBy: string[];
  type?: 'text' | 'image' | 'logistics' | 'quote';
  imageUrl?: string;
  metadata?: {
    type: 'freight' | 'express' | 'quote';
    status?: 'pending' | 'accepted' | 'declined';
    price?: number;
    volume?: string;
    weight?: string;
  };
}

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { sendMessage: sendMessageToFirestore, markAsRead } = useMessages();
  const insets = useSafeAreaInsets();
  
  // ✅ Récupération de TOUS les paramètres
  const params = useLocalSearchParams();
  
  // Paramètres du produit
  const productId = params.productId as string | undefined;
  const productName = params.productName as string | undefined;
  const productImage = params.productImage as string | undefined;
  const productPrice = params.productPrice as string | undefined;
  const sellerName = params.sellerName as string | undefined;
  const sellerId = params.sellerId as string | undefined;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversation, setConversation] = useState<any>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [otherParticipant, setOtherParticipant] = useState<any>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [sellerExists, setSellerExists] = useState<boolean | null>(null);
  
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Debug: voir ce qui est reçu
  useEffect(() => {
    console.log("📱 ConversationScreen - Paramètres reçus:", {
      conversationId: id,
      productId,
      productName,
      productImage: productImage ? productImage.substring(0, 50) + '...' : null,
      productPrice,
      sellerName,
      sellerId
    });
  }, []);

  const colors = {
    background: '#121212',
    header: '#1F1F1F',
    ownBubble: '#005C4B',
    otherBubble: '#2A2A2A',
    inputBg: '#1F1F1F',
    accent: '#00A884',
    warning: '#FF6B00',
    text: '#FFFFFF',
    subtext: '#8696A0',
  };

  // ✅ Vérifier que le vendeur existe
  const checkSellerExists = useCallback(async (sellerId: string) => {
    try {
      // Vérifier dans companies
      const companyRef = doc(db, 'companies', sellerId);
      const companySnap = await getDoc(companyRef);
      
      if (companySnap.exists()) {
        const data = companySnap.data();
        console.log("✅ Vendeur trouvé dans companies:", data.name);
        setSellerExists(true);
        setOtherParticipant({
          id: sellerId,
          ...data,
          isCompany: true,
          displayName: data.name || 'Entreprise',
          photoURL: data.logo || null
        });
        return true;
      }
      
      // Vérifier dans users
      const userRef = doc(db, 'users', sellerId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const data = userSnap.data();
        console.log("✅ Vendeur trouvé dans users:", data.displayName);
        setSellerExists(true);
        setOtherParticipant({
          id: sellerId,
          ...data,
          isCompany: false,
          displayName: data.displayName || 'Utilisateur',
          photoURL: data.photoURL || null
        });
        return true;
      }
      
      console.log("❌ Vendeur non trouvé avec l'ID:", sellerId);
      setSellerExists(false);
      return false;
    } catch (error) {
      console.error("Erreur vérification vendeur:", error);
      setSellerExists(false);
      return false;
    }
  }, []);

  // ✅ Charger les détails de la conversation
  useEffect(() => {
    if (!id || !user) return;

    const unsub = onSnapshot(doc(db, 'conversations', id), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log("📝 Conversation existante chargée");
        setConversation({ 
          id: docSnap.id, 
          ...data,
          companyId: data.companyId || null,
          companyName: data.companyName || null,
          companyLogo: data.companyLogo || null
        });
        setLoading(false);
      } else {
        // La conversation n'existe pas encore
        console.log("🆕 Nouvelle conversation à créer");
        
        // Vérifier que le vendeur existe
        const exists = await checkSellerExists(id);
        
        if (exists) {
          setConversation({
            id: id,
            participants: [user.uid, id],
            status: 'new',
            isNew: true
          });
        }
        setLoading(false);
      }
    });

    return () => unsub();
  }, [id, user, checkSellerExists]);

  // Charger les messages en temps réel
  useEffect(() => {
    if (!id || !user) return;
    
    let isMounted = true;
    
    const q = query(collection(db, 'conversations', id, 'messages'), orderBy('timestamp', 'asc'));
    
    const unsub = onSnapshot(q, (snapshot) => {
      if (!isMounted) return;

      const msgs: Message[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      })) as Message[];
      
      setMessages(msgs);
      setLoading(false);
    }, (error) => {
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, [id, user?.uid]);

  // ✅ Fonction pour injecter le message de négociation
  const handleNegotiatePress = useCallback(() => {
    if (productName) {
      const negotiationMessage = `Bonjour, je suis intéressé par le produit ${productName}. Est-il disponible ?`;
      setInputText(negotiationMessage);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [productName]);

  // ✅ Composant du bandeau produit
  const renderProductAnchor = () => {
    if (!productId || !productName) return null;

    return (
      <View style={styles.productAnchor}>
        <View style={styles.productAnchorContent}>
          <View style={styles.productImageContainer}>
            {productImage ? (
              <Image 
                source={{ uri: productImage }} 
                style={styles.productImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.productImagePlaceholder}>
                <Ionicons name="image-outline" size={20} color={colors.subtext} />
              </View>
            )}
          </View>

          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={1}>
              {productName}
            </Text>
            {productPrice && (
              <View style={styles.productPriceContainer}>
                <Text style={styles.productPriceLabel}>Prix: </Text>
                <Text style={styles.productPriceValue}>{productPrice}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity 
            style={styles.negotiateButton}
            onPress={handleNegotiatePress}
            activeOpacity={0.8}
          >
            <Ionicons name="chatbubble-outline" size={18} color="#FFF" />
            <Text style={styles.negotiateButtonText}>Négocier</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ✅ Fonction d'envoi de message améliorée
  const handleSend = async () => {
    if (!inputText.trim() || !user?.uid || !id || sending) return;
    
    // Vérifier que le vendeur existe
    if (sellerExists === false) {
      Alert.alert(
        "Erreur",
        "Ce vendeur n'existe pas ou n'a pas configuré sa messagerie."
      );
      return;
    }
    
    try {
      setSending(true);
      const text = inputText.trim();
      
      // Vérifier/Créer la conversation
      const conversationRef = doc(db, 'conversations', id);
      const convSnap = await getDoc(conversationRef);
      
      if (!convSnap.exists()) {
        // Créer la conversation avec toutes les infos
        const conversationData: any = {
          participants: [user.uid, id],
          type: 'entrepreneur',
          createdAt: serverTimestamp(),
          lastMessage: text,
          lastMessageTimestamp: serverTimestamp(),
          unreadCount: { [id]: 1 },
          updatedAt: serverTimestamp(),
          status: 'active'
        };

        // Ajouter les infos du vendeur si disponibles
        if (otherParticipant) {
          if (otherParticipant.isCompany) {
            conversationData.companyId = id;
            conversationData.companyName = otherParticipant.displayName;
            conversationData.companyLogo = otherParticipant.photoURL;
          }
        }

        // Ajouter les infos du produit
        if (productId) {
          conversationData.productId = productId;
          conversationData.productName = productName;
          conversationData.productImage = productImage;
          conversationData.productPrice = productPrice;
        }

        await setDoc(conversationRef, conversationData);
        console.log("✅ Nouvelle conversation créée");
      } else {
        // Mettre à jour le dernier message
        await setDoc(conversationRef, {
          lastMessage: text,
          lastMessageTimestamp: serverTimestamp(),
          [`unreadCount.${id}`]: (convSnap.data()?.unreadCount?.[id] || 0) + 1
        }, { merge: true });
      }

      // Créer le message
      const messageRef = doc(collection(db, 'conversations', id, 'messages'));
      await setDoc(messageRef, {
        id: messageRef.id,
        text: text,
        senderId: user.uid,
        senderName: user.displayName || 'Client',
        timestamp: serverTimestamp(),
        readBy: [user.uid],
        type: 'text'
      });

      setInputText('');
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      
    } catch (error) {
      console.error("❌ Erreur lors de l'envoi:", error);
      Alert.alert(
        "Erreur",
        "Impossible d'envoyer le message. Veuillez réessayer."
      );
    } finally {
      setSending(false);
    }
  };

  // ✅ Gestion du typing
  const handleTyping = useCallback(() => {
    if (!id || !user?.uid || sellerExists === false) return;
    const typingRef = doc(db, 'conversations', id, 'typing', user.uid);
    setDoc(typingRef, { 
      uid: user.uid, 
      name: user.displayName || 'Client', 
      timestamp: serverTimestamp() 
    });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => deleteDoc(typingRef), 3000);
  }, [id, user, sellerExists]);

  // ✅ Gérer les utilisateurs qui tapent
  useEffect(() => {
    if (!id || !user) return;
    
    const typingRef = collection(db, 'conversations', id, 'typing');
    const unsub = onSnapshot(typingRef, (snapshot) => {
      const typing: string[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.uid !== user.uid) {
          typing.push(data.uid);
        }
      });
      setTypingUsers(typing);
    });
    
    return () => unsub();
  }, [id, user]);

  // ✅ Header personnalisé
  const renderHeader = () => {
    const otherParticipantId = conversation?.participants?.find((p: string) => p !== user?.uid);
    const isOnline = onlineUsers.includes(otherParticipantId);
    const isEntrepreneur = otherParticipant?.isCompany || conversation?.type === 'entrepreneur';

    // Déterminer le nom à afficher
    let displayName = 'Conversation';
    if (sellerName) {
      displayName = sellerName;
    } else if (otherParticipant?.displayName) {
      displayName = otherParticipant.displayName;
    } else if (conversation?.companyName) {
      displayName = conversation.companyName;
    }

    return (
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <View style={styles.headerRow}>
            {/* Avatar */}
            {isEntrepreneur ? (
              otherParticipant?.photoURL || conversation?.companyLogo ? (
                <Image 
                  source={{ uri: otherParticipant?.photoURL || conversation?.companyLogo }} 
                  style={styles.companyAvatar} 
                />
              ) : (
                <View style={styles.companyAvatarPlaceholder}>
                  <Ionicons name="briefcase" size={22} color="#FF6B00" />
                </View>
              )
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person-circle" size={44} color="#FF6B00" />
              </View>
            )}
            
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {displayName}
              </Text>
              <View style={styles.headerSubtitleContainer}>
                {isEntrepreneur && (
                  <View style={styles.companyBadge}>
                    <Ionicons name="briefcase" size={12} color="#FF6B00" />
                    <Text style={styles.companyBadgeText}>Entreprise</Text>
                  </View>
                )}
                {typingUsers.length > 0 ? (
                  <Text style={styles.typingText}>en train d'écrire...</Text>
                ) : (
                  <Text style={[styles.onlineText, isOnline && styles.online]}>
                    {isOnline ? '● en ligne' : ''}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {sellerExists && (
          <View style={styles.headerActions}>
            <TouchableOpacity style={[styles.headerBtn, styles.audioCallBtn]}>
              <Ionicons name="call" size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.headerBtn, styles.videoCallBtn]}>
              <Ionicons name="videocam" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const own = item.senderId === user?.uid;
    
    return (
      <View style={[styles.messageRow, own ? styles.ownRow : styles.otherRow]}>
        <View style={[styles.bubble, own ? styles.ownBubble : styles.otherBubble]}>
          <Text style={styles.messageText}>{item.text}</Text>
          <View style={styles.messageFooter}>
            <Text style={styles.timeText}>
              {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // Si le vendeur n'existe pas
  if (sellerExists === false) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle="light-content" backgroundColor="#1F1F1F" />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={60} color={colors.warning} />
          <Text style={styles.errorTitle}>Vendeur introuvable</Text>
          <Text style={styles.errorText}>
            Ce vendeur n'existe pas ou n'a pas configuré sa messagerie.
          </Text>
          <TouchableOpacity 
            style={styles.errorButton}
            onPress={() => router.back()}
          >
            <Text style={styles.errorButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1F1F1F" />
      <Stack.Screen options={{ headerShown: false }} />
      
      {renderHeader()}
      {renderProductAnchor()}

      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={colors.warning} />
            <Text style={styles.loaderText}>Chargement de la conversation...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={{ padding: 12, paddingBottom: 20 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            showsVerticalScrollIndicator={false}
          />
        )}

        <View style={[styles.inputContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 10 }]}>
          <View style={styles.inputWrapper}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={inputText}
              onChangeText={(text) => { 
                setInputText(text); 
                if (text.length > 0) handleTyping(); 
              }}
              placeholder={otherParticipant?.isCompany ? "Écrire à l'entreprise..." : "Message..."}
              placeholderTextColor="#8696A0"
              multiline
            />
          </View>
          <TouchableOpacity 
            style={[styles.sendBtn, { backgroundColor: inputText.trim() ? colors.warning : '#374248' }]} 
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="send" size={20} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  
  header: { 
    backgroundColor: '#1F1F1F', 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 8, 
    paddingBottom: 10 
  },
  backBtn: { padding: 8 },
  headerInfo: { flex: 1, marginLeft: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerTextContainer: { flex: 1, marginLeft: 8 },
  headerTitle: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontWeight: '600',
    marginBottom: 2 
  },
  headerSubtitleContainer: { 
    flexDirection: 'row', 
    alignItems: 'center',
    gap: 6 
  },
  
  companyAvatar: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    borderWidth: 2,
    borderColor: '#FF6B00',
  },
  companyAvatarPlaceholder: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: '#2A2A2A',
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF6B00',
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  companyBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,107,0,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  companyBadgeText: { 
    color: '#FF6B00', 
    fontSize: 11, 
    fontWeight: '600' 
  },
  typingText: {
    color: '#FF6B00',
    fontSize: 12,
    fontStyle: 'italic',
  },
  onlineText: {
    color: '#8696A0',
    fontSize: 12,
  },
  online: {
    color: '#00A884',
  },
  
  headerActions: { 
    flexDirection: 'row', 
    alignItems: 'center',
    gap: 8, 
    marginRight: 8 
  },
  headerBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#2A2A2A',
    justifyContent: 'center', 
    alignItems: 'center',
  },
  audioCallBtn: {
    backgroundColor: '#00A884',
  },
  videoCallBtn: {
    backgroundColor: '#FF6B00',
  },
  
  messageRow: { marginVertical: 4, maxWidth: '85%' },
  ownRow: { alignSelf: 'flex-end' },
  otherRow: { alignSelf: 'flex-start' },
  bubble: { padding: 12, borderRadius: 16 },
  ownBubble: { backgroundColor: '#005C4B', borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: '#2A2A2A', borderBottomLeftRadius: 4 },
  messageText: { fontSize: 15, color: '#FFFFFF', lineHeight: 20 },
  messageFooter: { alignItems: 'flex-end', marginTop: 4 },
  timeText: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  
  productAnchor: {
    backgroundColor: '#2A2A2A',
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3A',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  productAnchorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  productImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#1F1F1F',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#3A3A3A',
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
    backgroundColor: '#1F1F1F',
  },
  productInfo: {
    flex: 1,
    gap: 4,
  },
  productName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  productPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productPriceLabel: {
    color: '#8696A0',
    fontSize: 12,
  },
  productPriceValue: {
    color: '#FF6B00',
    fontSize: 14,
    fontWeight: '700',
  },
  negotiateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B00',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  negotiateButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'flex-end', 
    paddingHorizontal: 8, 
    paddingTop: 8, 
    borderTopWidth: 0.5, 
    borderTopColor: '#2A2A2A',
    backgroundColor: '#121212',
  },
  inputWrapper: { 
    flex: 1, 
    backgroundColor: '#2A2A2A', 
    borderRadius: 24, 
    paddingHorizontal: 16,
    marginRight: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  input: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    paddingVertical: 10, 
    maxHeight: 100 
  },
  sendBtn: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    color: '#8696A0',
    marginTop: 12,
    fontSize: 14,
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    color: '#8696A0',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  errorButton: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});