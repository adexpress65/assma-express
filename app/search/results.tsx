import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import ProductCardPremium from '../../src/components/premium/ProductCardPremium';

export default function AISearchResults() {
  const router = useRouter();
  const { q } = useLocalSearchParams(); // Récupère le texte recherché
  const [loading, setLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [products, setProducts] = useState<any[]>([]);

  // --- CONFIGURATION API ---
  const API_KEY = "AIzaSyAszp1c3WqHU5t4CaNcrcJGgEA25kyP34E";
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

  useEffect(() => {
    fetchResults();
  }, [q]);

  const fetchResults = async () => {
    setLoading(true);
    try {
      // 1. Récupérer quelques produits pour donner du contexte à l'IA
      const qSnap = await getDocs(query(collection(db, "products"), limit(10)));
      const availableProducts = qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // 2. Appeler l'IA pour analyser la recherche par rapport aux produits
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `L'utilisateur recherche : "${q}". 
              Voici une liste de nos produits : ${JSON.stringify(availableProducts.map(p => p.name))}.
              Agis comme un expert shopping. Dis-moi si nous avons ce qu'il cherche ou suggère le produit le plus proche en 2 phrases courtes.`
            }]
          }]
        })
      });

      const data = await response.json();
      const suggestion = data.candidates[0].content.parts[0].text;
      
      setAiAnalysis(suggestion);
      setProducts(availableProducts); // Ici tu peux filtrer les produits selon la réponse de l'IA
    } catch (error) {
      console.error("Erreur Search IA:", error);
      setAiAnalysis("Désolé, je n'ai pas pu analyser votre recherche pour le moment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Résultats IA pour "{q}"</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>L'IA analyse les stocks...</Text>
        </View>
      ) : (
        <FlatList
          ListHeaderComponent={
            <View style={styles.aiBox}>
              <View style={styles.aiHeader}>
                <Ionicons name="sparkles" size={20} color="#2196F3" />
                <Text style={styles.aiTitle}>Analyse d'Askia IA</Text>
              </View>
              <Text style={styles.aiText}>{aiAnalysis}</Text>
            </View>
          }
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={2}
          renderItem={({ item }) => (
            <View style={styles.cardContainer}>
              <ProductCardPremium product={item} />
            </View>
          )}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    backgroundColor: '#fff',
    elevation: 2 
  },
  headerTitle: { fontSize: 16, fontWeight: 'bold', marginLeft: 15, color: '#333' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#666' },
  aiBox: { 
    backgroundColor: '#E3F2FD', 
    margin: 16, 
    padding: 15, 
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3'
  },
  aiHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  aiTitle: { marginLeft: 8, fontWeight: 'bold', color: '#1565C0' },
  aiText: { color: '#333', lineHeight: 20 },
  list: { paddingHorizontal: 8 },
  cardContainer: { flex: 0.5, padding: 4 }
});
