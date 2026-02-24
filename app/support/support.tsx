import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

// Structure d'un message
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

export default function AIChatScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Bonjour ! Je suis l'assistant IA d'A2Express, AskiaTchatIA 1.0. Je peux vous aider avec vos commandes, les livraisons ou nos produits, ainsi que toute sorte de questions. Que puis-je faire pour vous ?",
      sender: 'ai',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // --- CONFIGURATION API ---
  const API_KEY = "AIzaSyAszp1c3WqHU5t4CaNcrcJGgEA25kyP34E"; // Remplacez par votre clé obtenue sur Google AI Studio
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

  const callRealAI = async (userText: string) => {
    setIsTyping(true);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Tu es l'assistant de l'application e-commerce Assma Express. 
                     Réponds de manière courte, polie et professionnelle. 
                     Si on te pose une question sur Assma Express, sache que c'est une boutique de livraison rapide.
                     Voici la question du client : ${userText}`
            }]
          }]
        })
      });

      const data = await response.json();
      const aiResponse = data.candidates[0].content.parts[0].text;

      const newMessage: Message = {
        id: Date.now().toString(),
        text: aiResponse.trim(),
        sender: 'ai',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, newMessage]);
    } catch (error) {
      console.error("Erreur API:", error);
      const errorMsg: Message = {
        id: Date.now().toString(),
        text: "Désolé, je rencontre une petite difficulté technique. Veuillez vérifier votre connexion.",
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const sendMessage = () => {
    if (inputText.trim() === '') return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    const textToSend = inputText;
    setInputText('');
    
    // Appeler la vraie IA au lieu de la simulation
    callRealAI(textToSend);
  };

  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, isTyping]);

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[
      styles.messageBubble,
      item.sender === 'user' ? styles.userBubble : styles.aiBubble
    ]}>
      <Text style={[
        styles.messageText,
        item.sender === 'user' ? styles.userText : styles.aiText
      ]}>
        {item.text}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>Assistant Intelligent</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>IA Assma Connectée</Text>
          </View>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.chatList}
        ListFooterComponent={() => isTyping && (
          <View style={styles.typingContainer}>
            <ActivityIndicator size="small" color="#8E24AA" />
            <Text style={styles.typingText}>L'IA prépare une réponse...</Text>
          </View>
        )}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Posez votre question..."
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]} 
            onPress={sendMessage}
            disabled={!inputText.trim() || isTyping}
          >
            {isTyping ? 
              <ActivityIndicator color="#FFF" size="small" /> : 
              <Ionicons name="send" size={20} color="#FFF" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ... garder les mêmes styles que précédemment ...
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0F2F5' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: '#FFF',
      borderBottomWidth: 1,
      borderBottomColor: '#EEE',
    },
    headerInfo: { flex: 1, marginLeft: 12 },
    headerName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50', marginRight: 6 },
    statusText: { fontSize: 12, color: '#666' },
    chatList: { padding: 16, paddingBottom: 20 },
    messageBubble: {
      maxWidth: '85%',
      padding: 12,
      borderRadius: 20,
      marginBottom: 12,
    },
    userBubble: {
      alignSelf: 'flex-end',
      backgroundColor: '#1E88E5',
      borderBottomRightRadius: 4,
    },
    aiBubble: {
      alignSelf: 'flex-start',
      backgroundColor: '#FFF',
      borderBottomLeftRadius: 4,
      elevation: 2,
    },
    messageText: { fontSize: 15, lineHeight: 22 },
    userText: { color: '#FFF' },
    aiText: { color: '#333' },
    typingContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: 8, marginBottom: 10 },
    typingText: { fontSize: 12, color: '#666', marginLeft: 8, fontStyle: 'italic' },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      backgroundColor: '#FFF',
      borderTopWidth: 1,
      borderTopColor: '#EEE',
    },
    input: {
      flex: 1,
      backgroundColor: '#F0F2F5',
      borderRadius: 25,
      paddingHorizontal: 16,
      paddingVertical: 10,
      marginRight: 10,
      fontSize: 16,
      maxHeight: 100,
    },
    sendButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#8E24AA',
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendButtonDisabled: { backgroundColor: '#CCC' },
  });