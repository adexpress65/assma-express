import React, { useState, useEffect, useMemo } from 'react';
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

function normalizeImageUrl(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  if (raw.includes('firebasestorage.googleapis.com') && !raw.includes('alt=media')) {
    return raw.includes('?') ? `${raw}&alt=media` : `${raw}?alt=media`;
  }

  return raw;
}

function sanitizeSearchLabel(value: unknown): string {
  return String(value || '')
    .replace(/here is the json requested:?/gi, '')
    .replace(/here is the json:?/gi, '')
    .replace(/requested json:?/gi, '')
    .replace(/this is the json:?/gi, '')
    .replace(/the following json:?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function AISearchResults() {
  const router = useRouter();
  const { q, query: queryParam } = useLocalSearchParams<{ q?: string; query?: string }>();
  const [loading, setLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState('Recherche intelligente en cours...');
  const [products, setProducts] = useState<any[]>([]);
  const searchText = useMemo(() => sanitizeSearchLabel(queryParam || q || ''), [q, queryParam]);

  const API_KEY = "AIzaSyAszp1c3WqHU5t4CaNcrcJGgEA25kyP34E";
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

  useEffect(() => {
    void fetchResults();
  }, [searchText]);

  const fetchResults = async () => {
    setLoading(true);
    try {
      if (!searchText) {
        setProducts([]);
        setAiAnalysis('Saisissez un terme de recherche pour voir les résultats.');
        return;
      }

      const snapshot = await getDocs(query(collection(db, "products"), limit(80)));
      const allProducts = snapshot.docs.map((doc) => {
        const data = doc.data() as Record<string, any>;
        const mainImage = normalizeImageUrl(data.mainImage || data.imageUrl || data.image || data.images?.[0]);
        const images = Array.isArray(data.images)
          ? data.images.map((image) => normalizeImageUrl(image)).filter(Boolean)
          : mainImage
            ? [mainImage]
            : [];

        return {
          id: doc.id,
          ...data,
          mainImage,
          imageUrl: normalizeImageUrl(data.imageUrl || data.mainImage || data.image || data.images?.[0]),
          images,
          supplier: data.supplier || data.companyName || 'Fournisseur',
          companyName: data.companyName || data.supplier || 'Fournisseur',
          rating: Number(data.rating || 0),
          minOrder: Number(data.minOrder || data.minOrderQuantity || data.moq || 1),
          deliveryTime: data.deliveryTime || '3-7 jours',
          isVerified: Boolean(data.isVerified),
          price: Number(data.price || 0),
          originalPrice: Number(data.originalPrice || data.price || 0),
        };
      });
      const normalizedQuery = searchText.toLowerCase();

      const filteredProducts = allProducts.filter((product: any) => {
        const haystack = [
          product.name,
          product.category,
          product.categoryName,
          product.description,
          product.supplier,
          product.companyName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      });

      const fallbackProducts = filteredProducts.length > 0 ? filteredProducts : allProducts.slice(0, 20);
      setProducts(fallbackProducts);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `L'utilisateur recherche : "${searchText}". Voici une liste de nos produits : ${JSON.stringify(fallbackProducts.slice(0, 12).map((p: any) => p.name || 'Produit'))}. Donne une analyse courte en 2 phrases maximum.`
              }]
            }]
          })
        });

        const data = await response.json();
        const suggestion = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        setAiAnalysis(
          suggestion ||
          (filteredProducts.length > 0
            ? `${filteredProducts.length} résultat(s) trouvé(s) pour "${searchText}".`
            : `Aucun résultat exact trouvé pour "${searchText}", voici les produits les plus proches.`)
        );
      } catch {
        setAiAnalysis(
          filteredProducts.length > 0
            ? `${filteredProducts.length} résultat(s) trouvé(s) pour "${searchText}".`
            : `Aucun résultat exact trouvé pour "${searchText}", voici une sélection proche.`
        );
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error("Erreur Search IA:", error);
      setProducts([]);
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
        <Text style={styles.headerTitle}>Résultats pour "{searchText}"</Text>
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
