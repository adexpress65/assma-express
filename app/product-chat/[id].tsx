import React, { useEffect, useState, useRef } from 'react';
import { 
  View, Text, Image, StyleSheet, TouchableOpacity, ScrollView, 
  SafeAreaView, FlatList, TextInput, KeyboardAvoidingView, Platform, Dimensions 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/config/firebase'; 
import { 
  collection, addDoc, getDoc, query, orderBy, onSnapshot, 
  serverTimestamp, limit, getDocs, doc, setDoc 
} from 'firebase/firestore';

const { width } = Dimensions.get('window');

export default function ProductChatScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [showInquiry, setShowInquiry] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const [sellerData, setSellerData] = useState<{name: string, logo: string | null}>({
    name: (params.companyName as string) || "Vendeur",
    logo: (params.sellerLogo as string) || null
  });

  // --- LOGIQUE ID SÉCURISÉE ---
  let rawSellerId = typeof params.sellerId === "string" ? params.sellerId : typeof params.id === "string" ? params.id : null;
  if (rawSellerId && user?.uid && rawSellerId.includes("_")) {
    const parts = rawSellerId.split("_");
    rawSellerId = parts.find((p) => p !== user.uid) || null;
  }
  const currentSellerId = rawSellerId && rawSellerId !== user?.uid ? rawSellerId : null;
  const chatID = user?.uid && currentSellerId ? [user.uid, currentSellerId].sort().join("_") : null;
  const hasFreeShipping = params.hasFreeShipping === 'true' || params.hasFreeShipping === true;

  // --- EFFETS ---
  useEffect(() => {
    if (!user || !currentSellerId || !chatID) return;

    const fetchSellerInfo = async () => {
      try {
        const companyRef = doc(db, 'users', currentSellerId);
        const companySnap = await getDoc(companyRef);
        if (companySnap.exists()) {
          const data = companySnap.data();
          setSellerData({
            name: data.name || data.displayName || params.companyName || "Vendeur",
            logo: data.logo || data.imageUrl || data.photoURL || null
          });
        }
      } catch (error) { console.error("Erreur fetch seller:", error); }
    };

    fetchSellerInfo();

    const q = query(collection(db, 'conversations', chatID, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(fetchedMessages);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    });

    return () => unsubscribe();
  }, [chatID, user]);

  // --- ACTIONS ---
  const sendMessage = async (text: string, isProductCard = false) => {
    const messageToSend = text || inputText;
    if (!user || !chatID || (!messageToSend && !isProductCard)) return;

    const messageData: any = {
      senderId: user.uid,
      text: messageToSend,
      createdAt: serverTimestamp(),
      type: isProductCard ? 'product_card' : 'text',
    };

    if (isProductCard) {
      messageData.productInfo = {
        id: params.productId,
        name: params.productName,
        price: params.productPrice,
        image: params.productImage,
        hasFreeShipping: hasFreeShipping,
      };
      setShowInquiry(false); // Cache la petite carte après envoi
    }

    setInputText(''); 
    
    try {
      await addDoc(collection(db, 'conversations', chatID, 'messages'), messageData);
      const convRef = doc(db, 'conversations', chatID);
      await setDoc(convRef, {
        lastMessage: isProductCard ? "📦 Produit partagé" : messageToSend,
        updatedAt: serverTimestamp(),
        participants: [user.uid, currentSellerId],
        sellerName: sellerData.name,
        sellerLogo: sellerData.logo,
        unreadCount: 0, 
      }, { merge: true });
    } catch (e) { console.error("Erreur envoi:", e); }
  };

  if (!chatID) return null;

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. HEADER STYLE ALIBABA */}
      <View style={styles.aliHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
          <Ionicons name="chevron-back" size={26} color="#333" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{sellerData.name}</Text>
          <View style={styles.onlineStatus}>
            <View style={styles.onlineDot} />
            <Text style={styles.headerSub}>En ligne • 10:45 heure locale</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIcon}><Ionicons name="storefront-outline" size={22} color="#333" /></TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}><Ionicons name="ellipsis-vertical" size={22} color="#333" /></TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        
        {/* LISTE DES MESSAGES */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isMine = item.senderId === user?.uid;
            if (item.type === 'product_card') {
              return (
                <View style={[styles.msgRow, isMine ? styles.myRow : styles.theirRow]}>
                  <View style={styles.productBubble}>
                    <TouchableOpacity onPress={() => router.push(`/product/${item.productInfo.id}`)} style={styles.bubbleCard}>
                      <Image source={{ uri: item.productInfo.image }} style={styles.bubbleImg} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.bubbleName} numberOfLines={2}>{item.productInfo.name}</Text>
                        <Text style={styles.bubblePrice}>{item.productInfo.price} CFA</Text>
                      </View>
                    </TouchableOpacity>
                    <Text style={styles.bubbleText}>{item.text}</Text>
                  </View>
                </View>
              );
            }
            return (
              <View style={[styles.msgRow, isMine ? styles.myRow : styles.theirRow]}>
                <View style={[styles.textBubble, isMine ? styles.myBubble : styles.theirBubble]}>
                  <Text style={[styles.msgText, isMine ? styles.myText : styles.theirText]}>{item.text}</Text>
                </View>
              </View>
            );
          }}
          contentContainerStyle={{ padding: 15 }}
        />

        {/* 2. CARTE D'ENQUÊTE FLOTTANTE (LOOK ALIBABA) */}
        {showInquiry && (
          <View style={styles.inquiryCard}>
            <View style={styles.inquiryTop}>
              <Text style={styles.inquiryLabel}>Prendre des renseignements sur ce produit :</Text>
              <TouchableOpacity onPress={() => setShowInquiry(false)}><Ionicons name="close" size={18} color="#999" /></TouchableOpacity>
            </View>
            <View style={styles.inquiryMain}>
              <Image source={{ uri: params.productImage as string }} style={styles.inquiryImg} />
              <View style={styles.inquiryDetails}>
                <Text style={styles.inquiryPrice}>{params.productPrice} CFA</Text>
                <Text style={styles.inquiryShipping}>Livraison gratuite disponible</Text>
              </View>
              <TouchableOpacity style={styles.sendBtnAli} onPress={() => sendMessage("Je souhaite avoir des renseignements sur ce produit", true)}>
                <Text style={styles.sendBtnTextAli}>Envoyer</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 3. FOOTER AVEC ACTIONS RAPIDES */}
        <View style={styles.footer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickBar}>
            {["Débuter la commande", "Négocier", "Échantillon", "Mini-site"].map((t) => (
              <TouchableOpacity key={t} style={styles.quickChip} onPress={() => sendMessage(t)}>
                <Text style={styles.quickText}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.inputArea}>
            <TouchableOpacity style={styles.addIcon}><Ionicons name="add-circle-outline" size={28} color="#666" /></TouchableOpacity>
            <TextInput
              style={styles.textInput}
              placeholder="Écrire un message..."
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
            <TouchableOpacity style={styles.addIcon}><MaterialCommunityIcons name="sticker-emoji" size={24} color="#666" /></TouchableOpacity>
            {inputText.length > 0 && (
              <TouchableOpacity onPress={() => sendMessage(inputText)} style={styles.sendCircle}>
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
  
  // Header
  aliHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#DDD',
  },
  headerIcon: { padding: 5 },
  headerCenter: { flex: 1, marginLeft: 10 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  headerSub: { fontSize: 11, color: '#999' },
  onlineStatus: { flexDirection: 'row', alignItems: 'center' },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00B050', marginRight: 4 },
  headerActions: { flexDirection: 'row', gap: 10 },

  // Messages
  msgRow: { marginBottom: 15, flexDirection: 'row', width: '100%' },
  myRow: { justifyContent: 'flex-end' },
  theirRow: { justifyContent: 'flex-start' },
  textBubble: { padding: 12, borderRadius: 15, maxWidth: '80%' },
  myBubble: { backgroundColor: '#FFEDD5', borderBottomRightRadius: 2 },
  theirBubble: { backgroundColor: '#FFF', borderBottomLeftRadius: 2 },
  msgText: { fontSize: 15, color: '#333' },
  myText: { color: '#000' },
  theirText: { color: '#000' },

  // Product Bubble
  productBubble: { backgroundColor: '#FFF', padding: 8, borderRadius: 12, width: '85%', elevation: 1 },
  bubbleCard: { flexDirection: 'row', backgroundColor: '#F8F8F8', padding: 8, borderRadius: 8 },
  bubbleImg: { width: 60, height: 60, borderRadius: 6 },
  bubbleName: { fontSize: 12, fontWeight: '500' },
  bubblePrice: { fontSize: 14, fontWeight: 'bold', color: '#FF6A00', marginTop: 4 },
  bubbleText: { marginTop: 8, fontSize: 14, color: '#444' },

  // Inquiry Floating Card (ALIBABA STYLE)
  inquiryCard: {
    marginHorizontal: 10,
    backgroundColor: '#FFF',
    borderRadius: 15,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
  },
  inquiryTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  inquiryLabel: { fontSize: 12, color: '#666' },
  inquiryMain: { flexDirection: 'row', alignItems: 'center' },
  inquiryImg: { width: 50, height: 50, borderRadius: 8 },
  inquiryDetails: { flex: 1, marginLeft: 12 },
  inquiryPrice: { fontSize: 16, fontWeight: 'bold' },
  inquiryShipping: { fontSize: 11, color: '#00B050' },
  sendBtnAli: { backgroundColor: '#FF6A00', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  sendBtnTextAli: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },

  // Footer & Input
  footer: { backgroundColor: '#FFF', borderTopWidth: 0.5, borderTopColor: '#DDD', paddingBottom: Platform.OS === 'ios' ? 25 : 10 },
  quickBar: { paddingVertical: 10, paddingHorizontal: 10 },
  quickChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, backgroundColor: '#F8F8F8', marginRight: 8, borderWidth: 1, borderColor: '#EEE' },
  quickText: { fontSize: 12, color: '#333' },
  inputArea: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  textInput: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, fontSize: 15, maxHeight: 100 },
  addIcon: { padding: 8 },
  sendCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FF6A00', justifyContent: 'center', alignItems: 'center', marginLeft: 5 }
});
