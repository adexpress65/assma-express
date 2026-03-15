import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, SafeAreaView, Keyboard, ScrollView, Linking, ActivityIndicator, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// FIREBASE
import { db } from '../../src/config/firebase'; 
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  imageUrl?: string;
}

export default function AIAssistantScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Bonjour ! Je suis Askia, votre assistant A2Express 🇲🇱.\n\nJe peux vous aider pour vos achats, mais je peux aussi :\n• Vous donner des conseils business 💡\n• Répondre à vos questions de culture générale 🌍\n• Vous aider pour une recette ou un calcul 🍳\n\nQue voulez-vous savoir ?",
      sender: 'ai',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const WHATSAPP_NUMBER = "+22375292946";

  const fetchProductData = async (searchTerm: string) => {
    try {
      const term = searchTerm.toLowerCase();
      const productsRef = collection(db, "products");
      const q = query(productsRef, where("nameLower", ">=", term), where("nameLower", "<=", term + "\uf8ff"), limit(1));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return null;
      const p = querySnapshot.docs[0].data();
      return {
        context: `[PRODUIT TROUVÉ: ${p.name}, PRIX: ${p.price} XOF, VENDEUR: ${p.supplier}, DÉLAI: ${p.deliveryTime}]`,
        image: p.mainImage || p.imageUrl
      };
    } catch (error) { return null; }
  };

  const callGeminiAI = async (userText: string) => {
    if (isTyping) return;
    setIsTyping(true);

    try {
      const API_KEY = "AIzaSyAaDzKKP2ttIIPTy_eAXHcJun0-XHkwNwo";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

      const productResult = await fetchProductData(userText);

      const systemPrompt = `Tu es Askia, une IA experte et cultivée pour A2Express. 
      - Tu réponds à TOUT : culture, histoire, cuisine, conseils, business, météo.
      - Si tu trouves un produit dans ce CONTEXTE : ${productResult?.context || "Aucun"}, présente-le.
      - Rappelle que A2Express livre partout au Mali en 7-15 jours.
      - Ton ton est amical, intelligent et serviable.`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\nUtilisateur: ${userText}` }] }],
          generationConfig: { maxOutputTokens: 500, temperature: 0.8 }
        }),
      });

      const data = await response.json();
      const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (aiText) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          text: aiText.trim(),
          sender: "ai",
          timestamp: new Date(),
          imageUrl: productResult?.image
        }]);
      }
    } catch (error) { console.error(error); } finally { setIsTyping(false); }
  };

  const sendMessage = (manualText?: string) => {
    const text = manualText || inputText;
    if (!text.trim() || isTyping) return;
    setMessages(prev => [...prev, { id: Date.now().toString(), text, sender: 'user', timestamp: new Date() }]);
    setInputText('');
    Keyboard.dismiss();
    callGeminiAI(text);
  };

  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);
  }, [messages, isTyping]);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#8E24AA', '#4A148C']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Assistant Askia IA</Text>
          <Text style={styles.statusText}>Expert Business & Culture G</Text>
        </View>
      </LinearGradient>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={[styles.msgWrapper, item.sender === 'ai' ? styles.aiWrapper : styles.userWrapper]}>
            <View style={[styles.bubble, item.sender === 'ai' ? styles.aiBubble : styles.userBubble]}>
              {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.productImage} />}
              <Text style={[styles.msgText, item.sender === 'ai' ? styles.aiText : styles.userText]}>{item.text}</Text>
            </View>
          </View>
        )}
        contentContainerStyle={{ padding: 15 }}
      />

      {/* INDICATIONS / SUGGESTIONS POUR LE CLIENT */}
      <View style={styles.shortcutContainer}>
        <Text style={styles.suggestionTitle}>Essayez de demander :</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15 }}>
          <TouchableOpacity style={styles.shortcutBtn} onPress={() => sendMessage("Quelles sont les actualités au Mali ?")}>
            <Text style={styles.shortcutText}>🌍 Actualités</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shortcutBtn} onPress={() => sendMessage("Donne moi une idée de business rentable")}>
            <Text style={styles.shortcutText}>💡 Idée Business</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shortcutBtn} onPress={() => sendMessage("Recette du Mafé")}>
            <Text style={styles.shortcutText}>🍳 Cuisine</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shortcutBtn} onPress={() => sendMessage("Robe longue fille")}>
            <Text style={styles.shortcutText}>👗 Catalogue</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <View style={styles.inputArea}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Posez n'importe quelle question..."
              value={inputText}
              onChangeText={setInputText}
            />
            <TouchableOpacity onPress={() => sendMessage()} disabled={isTyping}>
              <LinearGradient colors={['#8E24AA', '#4A148C']} style={styles.sendGrad}>
                {isTyping ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="send" size={18} color="#FFF" />}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FD' },
  header: { 
    padding: 20, 
    paddingTop: Platform.OS === 'android' ? 45 : 20, 
    flexDirection: 'row', 
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20 
  },
  backBtn: { marginRight: 15 },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  statusText: { color: '#E0E0E0', fontSize: 12, marginTop: 2 },
  msgWrapper: { marginVertical: 8, maxWidth: '85%' },
  userWrapper: { alignSelf: 'flex-end' },
  aiWrapper: { alignSelf: 'flex-start' },
  bubble: { padding: 12, borderRadius: 20 },
  userBubble: { backgroundColor: '#8E24AA', borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: '#FFF', borderBottomLeftRadius: 4, elevation: 1 },
  productImage: { width: 200, height: 200, borderRadius: 10, marginBottom: 10 },
  msgText: { fontSize: 15, lineHeight: 22 },
  userText: { color: '#FFF' },
  aiText: { color: '#333' },
  shortcutContainer: { paddingVertical: 10, backgroundColor: '#F8F9FD' },
  suggestionTitle: { marginLeft: 15, fontSize: 12, color: '#888', marginBottom: 5, fontWeight: 'bold' },
  shortcutBtn: { backgroundColor: '#FFF', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#DDD' },
  shortcutText: { color: '#555', fontSize: 13 },
  inputArea: { 
    backgroundColor: '#FFF', 
    paddingHorizontal: 15, 
    // Correction ici : 60 pour remonter la barre sur Android, 20 pour iOS (géré par le Safe Area)
    paddingBottom: Platform.OS === 'android' ? 60 : 20, 
    paddingTop: 10, 
    borderTopWidth: 1, 
    borderTopColor: '#EEE' 
  },
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F1F3F7', 
    borderRadius: 30, 
    paddingHorizontal: 5 
  },
  input: { flex: 1, padding: 12, fontSize: 15, maxHeight: 100 },
  sendGrad: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' }
});
