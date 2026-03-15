import React, { useState, useEffect, useRef } from 'react';
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
  ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useAuth } from '../../src/contexts/AuthContext';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: screenWidth } = Dimensions.get('window');

// --- FONCTION DE NETTOYAGE POUR ANDROID ---
const getSafeFirebaseUri = (uri: any) => {
  if (!uri || typeof uri !== 'string') return null;
  try {
    let clean = decodeURIComponent(uri.trim().replace(/[\s\u0000-\u001F\u007F-\u009F\uFEFF]+/g, ''));
    if (clean.includes('firebasestorage.googleapis.com')) {
      const parts = clean.split('/o/');
      if (parts.length > 1) {
        const baseUrl = parts[0] + '/o/';
        const fullPath = parts[1].split('?')[0]; 
        const params = parts[1].split('?')[1];   
        const pathSegments = fullPath.split('/');
        const folder = pathSegments[0];
        const fileName = pathSegments[pathSegments.length - 1];
        return `${baseUrl}${folder}%2F${fileName}?${params}`;
      }
    }
    return clean;
  } catch (e) {
    return uri;
  }
};

interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: Date;
  type?: 'text' | 'product_card';
  productInfo?: {
    id: string;
    name: string;
    price: string;
    image: string;
  };
}

export default function ConversationScreen() {
  const params = useLocalSearchParams<any>();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const sellerId = (params.sellerId || params.id) as string | undefined;
  const chatId = user?.uid && sellerId ? [user.uid, sellerId].sort().join("_") : undefined;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sellerData, setSellerData] = useState<any>(null);
  const [showInquiryCard, setShowInquiryCard] = useState(!!params.productId);

  const flatListRef = useRef<FlatList>(null);

  const getSafeProductImage = () => {
    const rawUri = params.productImage || params.imageUrl || params.mainImage || (params.images && params.images[0]);
    return getSafeFirebaseUri(rawUri);
  };

  useEffect(() => {
    if (!chatId || !sellerId) return;

    const fetchSeller = async () => {
      try {
        const docRef = doc(db, 'users', sellerId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
           setSellerData(snap.data());
        } else {
           const compRef = doc(db, 'companies', sellerId);
           const compSnap = await getDoc(compRef);
           if (compSnap.exists()) setSellerData(compSnap.data());
        }
      } catch (e) { console.error("Erreur Fetch Seller:", e); }
    };
    fetchSeller();

    const q = query(collection(db, "conversations", chatId, "messages"), orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      })) as Message[];
      setMessages(msgs);
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    });

    return () => unsub();
  }, [chatId, sellerId]);

  const handleSend = async (customText?: string, isProduct = false) => {
    const textToSend = customText || inputText;
    if (!textToSend.trim() || !user || !chatId || !sellerId) return;

    try {
      setSending(true);
      const msgRef = doc(collection(db, "conversations", chatId, "messages"));
      const msgData: any = {
        id: msgRef.id,
        text: textToSend.trim(),
        senderId: user.uid,
        timestamp: serverTimestamp(),
        type: isProduct ? 'product_card' : 'text'
      };

      if (isProduct) {
        msgData.productInfo = {
          id: params.productId || "",
          name: params.productName || "Produit",
          price: params.productPrice || "À discuter",
          image: params.productImage || params.imageUrl || "" // Stockage de l'URL brute
        };
        setShowInquiryCard(false);
      }

      await setDoc(msgRef, msgData);
      
      await setDoc(doc(db, "conversations", chatId), {
        lastMessage: isProduct ? "📦 Produit partagé" : textToSend,
        updatedAt: serverTimestamp(),
        participants: [user.uid, sellerId],
        sellerName: params.sellerName || sellerData?.name || "Boutique",
        sellerLogo: params.sellerLogo || sellerData?.logo || sellerData?.imageUrl || null
      }, { merge: true });

      setInputText("");
    } catch (e) { 
        console.error(e);
        Alert.alert("Erreur", "Impossible d'envoyer."); 
    } finally { setSending(false); }
  };

  const renderHeader = () => {
    const avatarUri = getSafeFirebaseUri(params.sellerLogo || sellerData?.logo || sellerData?.photoURL || sellerData?.imageUrl);
    return (
      <View style={[styles.header, { paddingTop: insets.top + 5 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
          <Ionicons name="chevron-back" size={26} color="#333" />
        </TouchableOpacity>
        
        <View style={styles.headerProfile}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person-circle" size={38} color="#CCC" />
            </View>
          )}
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {params.sellerName || sellerData?.name || "Boutique"}
            </Text>
            <View style={styles.statusRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.headerSub}>En ligne</Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIcon}><Ionicons name="storefront-outline" size={22} color="#333" /></TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}><Ionicons name="ellipsis-vertical" size={22} color="#333" /></TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderInquiryCard = () => {
    const pImage = getSafeProductImage();
    if (!showInquiryCard || !params.productId) return null;
    return (
      <View style={styles.inquiryCard}>
        <View style={styles.inquiryTop}>
          <Text style={styles.inquiryLabel}>Renseignement sur ce produit :</Text>
          <TouchableOpacity onPress={() => setShowInquiryCard(false)}>
            <Ionicons name="close" size={18} color="#999" />
          </TouchableOpacity>
        </View>
        <View style={styles.inquiryContent}>
          {pImage ? (
             <Image source={{ uri: pImage }} style={styles.inquiryImg} />
          ) : (
             <View style={[styles.inquiryImg, {backgroundColor: '#EEE'}]} />
          )}
          <View style={styles.inquiryDetails}>
            <Text style={styles.inquiryPrice}>{params.productPrice} CFA</Text>
            <Text style={styles.inquiryDelivery}>Expédition rapide</Text>
          </View>
          <TouchableOpacity style={styles.inquirySendBtn} onPress={() => handleSend("Je suis intéressé par ce produit", true)}>
            <Text style={styles.inquirySendText}>Envoyer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      <Stack.Screen options={{ headerShown: false }} />
      {renderHeader()}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        
        {loading ? (
          <ActivityIndicator style={{ flex: 1 }} color="#FF6A00" />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isMine = item.senderId === user?.uid;
              const productImg = item.type === 'product_card' ? getSafeFirebaseUri(item.productInfo?.image) : null;
              
              return (
                <View style={[styles.msgRow, isMine ? styles.myRow : styles.theirRow]}>
                  <View style={[styles.bubble, isMine ? styles.myBubble : styles.theirBubble]}>
                    {item.type === 'product_card' && item.productInfo && (
                       <View style={styles.cardInChat}>
                          {productImg ? (
                             <Image source={{ uri: productImg }} style={styles.cardInChatImg} resizeMode="cover" />
                          ) : (
                             <View style={[styles.cardInChatImg, {backgroundColor: '#EEE'}]} />
                          )}
                          <Text style={styles.cardInChatPrice}>{item.productInfo.price} CFA</Text>
                       </View>
                    )}
                    <Text style={styles.msgText}>{item.text}</Text>
                    <Text style={styles.msgTime}>
                      {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              );
            }}
            contentContainerStyle={{ padding: 15 }}
          />
        )}

        {renderInquiryCard()}

        <View style={[styles.inputSection, { paddingBottom: insets.bottom || 10 }]}>
           <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickActions}>
              {["C'est disponible ?", "Dernier prix ?", "Livraison ?"].map(t => (
                <TouchableOpacity key={t} style={styles.chip} onPress={() => handleSend(t)}>
                  <Text style={styles.chipText}>{t}</Text>
                </TouchableOpacity>
              ))}
           </ScrollView>

           <View style={styles.inputRow}>
              <TouchableOpacity style={styles.iconBtn}><Ionicons name="add-circle-outline" size={28} color="#666" /></TouchableOpacity>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Écrire..."
                multiline
              />
              <TouchableOpacity style={styles.iconBtn}><MaterialCommunityIcons name="sticker-emoji" size={24} color="#666" /></TouchableOpacity>
              {inputText.length > 0 && (
                <TouchableOpacity onPress={() => handleSend()} style={styles.sendCircle}>
                  <Ionicons name="send" size={18} color="#FFF" />
                </TouchableOpacity>
              )}
           </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F4F4' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingBottom: 10, backgroundColor: '#FFF', borderBottomWidth: 0.5, borderBottomColor: '#EEE' },
  headerIcon: { padding: 5 },
  headerProfile: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 5 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#EEE' },
  avatarPlaceholder: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  headerCenter: { marginLeft: 10 },
  headerTitle: { fontSize: 16, fontWeight: 'bold' },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00B050', marginRight: 4 },
  headerSub: { fontSize: 11, color: '#999' },
  headerRight: { flexDirection: 'row', gap: 5 },
  msgRow: { marginBottom: 12, flexDirection: 'row', width: '100%' },
  myRow: { justifyContent: 'flex-end' },
  theirRow: { justifyContent: 'flex-start' },
  bubble: { padding: 10, borderRadius: 15, maxWidth: '80%', elevation: 1 },
  myBubble: { backgroundColor: '#FFEBD6', borderBottomRightRadius: 2 },
  theirBubble: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 2 },
  msgText: { fontSize: 15, color: '#333' },
  msgTime: { fontSize: 10, color: '#999', alignSelf: 'flex-end', marginTop: 4 },
  cardInChat: { backgroundColor: '#FFF', borderRadius: 8, padding: 4, marginBottom: 5, borderWidth: 1, borderColor: '#EEE' },
  cardInChatImg: { width: 130, height: 130, borderRadius: 6 },
  cardInChatPrice: { fontWeight: 'bold', color: '#FF6A00', marginTop: 5, fontSize: 14 },
  inquiryCard: { backgroundColor: '#FFF', marginHorizontal: 10, padding: 12, borderRadius: 15, elevation: 8, marginBottom: 5 },
  inquiryTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  inquiryLabel: { fontSize: 12, color: '#666' },
  inquiryContent: { flexDirection: 'row', alignItems: 'center' },
  inquiryImg: { width: 55, height: 55, borderRadius: 8, backgroundColor: '#F5F5F5' },
  inquiryDetails: { flex: 1, marginLeft: 12 },
  inquiryPrice: { fontSize: 16, fontWeight: 'bold' },
  inquiryDelivery: { fontSize: 11, color: '#00B050' },
  inquirySendBtn: { backgroundColor: '#FF6A00', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  inquirySendText: { color: '#FFF', fontWeight: 'bold' },
  inputSection: { backgroundColor: '#FFF', borderTopWidth: 0.5, borderTopColor: '#EEE' },
  quickActions: { paddingVertical: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, backgroundColor: '#F8F8F8', marginRight: 8, borderWidth: 1, borderColor: '#EEE' },
  chipText: { fontSize: 12, color: '#333' },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5, paddingBottom: 5 },
  input: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, maxHeight: 100 },
  iconBtn: { padding: 8 },
  sendCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FF6A00', justifyContent: 'center', alignItems: 'center', marginLeft: 4 },
});