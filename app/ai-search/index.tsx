import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  Keyboard
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '@/config/firebase';

export default function AISearchScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [results, setResults] = useState<any[]>([]);

  // --- CONFIGURATION API ---


  const handleAISearch = async () => {
    if (!searchQuery.trim()) return;
    Keyboard.dismiss();
    setIsLoading(true);
    setAiSuggestion('');

    const API_KEY = "AIzaSyBP6w8FaUK-ubD12y4upZ3PbACgmZuGdS4";
    const MODEL_NAME = "models/gemini-2.5-flash"; 
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/${MODEL_NAME}:generateContent?key=${API_KEY}`;

    try {
      // 1. Analyse par l'IA (Askia)
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Tu es Askia, l'expert shopping A2Express. 
              L'utilisateur recherche : "${searchQuery}".
              Donne un conseil très court (2 lignes max) et finis TOUJOURS en disant "Je vous montre les résultats immédiatement...".`
            }]
          }]
        })
      });

      const data = await response.json();
      const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Analyse en cours...";
      setAiSuggestion(aiText);

      // 2. REDIRECTION AUTOMATIQUE (Le "Pont")
      // On attend 3.5 secondes pour que l'utilisateur lise le conseil d'Askia
      setTimeout(() => {
        router.push({
          pathname: '/search-results',
          params: { query: searchQuery } // On passe la recherche à ta page de résultats
        });
        setIsLoading(false);
      }, 2500);

    } catch (error) {
      console.error("Erreur Recherche IA:", error);
      // En cas d'erreur IA, on redirige quand même vers les résultats classiques
      router.push({
        pathname: '/search-results',
        params: { query: searchQuery }
      });
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close-outline" size={30} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recherche IA</Text>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#8E24AA" style={styles.searchIcon} />
          <TextInput
            style={styles.input}
            placeholder="Que cherchez-vous aujourd'hui ?"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleAISearch}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="backspace" size={20} color="#CCC" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={handleAISearch} disabled={isLoading}>
          <LinearGradient
            colors={['#8E24AA', '#1E88E5']}
            style={styles.aiButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color="#FFF" />
                <Text style={styles.aiButtonText}>Analyser avec Askia</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {aiSuggestion ? (
          <View style={styles.aiCard}>
            <View style={styles.aiCardHeader}>
              <Ionicons name="bulb" size={20} color="#FFD700" />
              <Text style={styles.aiCardTitle}>Conseil d'Askia</Text>
            </View>
            <Text style={styles.aiCardText}>{aiSuggestion}</Text>
          </View>
        ) : !isLoading && (
          <View style={styles.emptyState}>
            <Ionicons name="color-wand-outline" size={80} color="#E0E0E0" />
            <Text style={styles.emptyText}>Dites-moi ce que vous voulez, je trouverai le meilleur produit pour vous.</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', marginLeft: 10, color: '#333' },
  searchSection: { padding: 20 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 15,
    paddingHorizontal: 15,
    height: 55,
    marginBottom: 15,
  },
  searchIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: '#333' },
  aiButton: {
    flexDirection: 'row',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiButtonText: { color: '#FFF', fontWeight: 'bold', marginLeft: 10, fontSize: 16 },
  content: { flex: 1, paddingHorizontal: 20 },
  aiCard: {
    backgroundColor: '#F3E5F5',
    padding: 20,
    borderRadius: 20,
    borderLeftWidth: 5,
    borderLeftColor: '#8E24AA',
    marginTop: 10,
  },
  aiCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  aiCardTitle: { fontWeight: 'bold', color: '#8E24AA', marginLeft: 8 },
  aiCardText: { fontSize: 15, color: '#444', lineHeight: 22 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', opacity: 0.6 },
  emptyText: { textAlign: 'center', marginTop: 20, color: '#666', paddingHorizontal: 40 },
});
