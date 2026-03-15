import React, { useState, useEffect, useRef } from "react";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { 
  Platform, Modal, View, Text, Animated, StyleSheet, 
  Dimensions, TouchableOpacity, Image, ActivityIndicator 
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../src/config/firebase'; 

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [showFlash, setShowFlash] = useState(false); // Par défaut false pour attendre le chargement
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const fadeAnim = useRef(new Animated.Value(0)).current; 
  const blinkAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current; 

  useEffect(() => {
    const prepareFlashSale = async () => {
      try {
        setLoading(true);
        const q = query(
          collection(db, 'products'),
          where('status', '==', 'published'),
          where('price', '<=', 1000),
          limit(3)
        );
        
        const snap = await getDocs(q);
        const items = snap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            image: data.mainImage || data.imageUrl || (data.images && data.images[0]),
            price: data.price
          };
        });

        // 🔥 ÉTAPE CLÉ : On force le téléchargement des images avant d'afficher
        const prefetchImages = items.map(item => {
          if (item.image) return Image.prefetch(item.image);
        });

        await Promise.all(prefetchImages);
        setProducts(items);
        
        // On n'affiche le modal que si on a des produits
        if (items.length > 0) {
          setShowFlash(true);
          // Animation d'entrée fluide
          Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true })
          ]).start();
        }

      } catch (e) {
        console.log("Erreur chargement flash:", e);
      } finally {
        setLoading(false);
      }
    };

    prepareFlashSale();

    // Animation Clignotement
    Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0.4, duration: 400, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ])
    ).start();

  }, []);

  const handleClose = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => setShowFlash(false));
  };

  return (
    <>
      <Modal transparent visible={showFlash} animationType="none">
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <LinearGradient colors={['#FF4444', '#CC0000']} style={styles.modalContent}>
              
              <Animated.View style={{ opacity: blinkAnim, alignItems: 'center' }}>
                <Ionicons name="flash" size={50} color="#FFD700" />
                <Text style={styles.megaTitle}>VENTE FLASH !</Text>
                <Text style={styles.megaSubtitle}>EXCLUSIVITÉS À MOINS DE 1000F</Text>
              </Animated.View>

              <View style={styles.productRow}>
                {products.map((p, i) => (
                  <View key={p.id || i} style={styles.productCircle}>
                    <Image source={{ uri: p.image }} style={styles.prodImg} />
                    <View style={styles.priceBadge}>
                      <Text style={styles.priceBadgeText}>{p.price}F</Text>
                    </View>
                  </View>
                ))}
              </View>

              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => { handleClose(); router.push("/flash-deals"); }}
              >
                <Text style={styles.actionText}>EN PROFITER</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipBtn} onPress={handleClose}>
                <Text style={styles.skipText}>Plus tard</Text>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        </Animated.View>
      </Modal>

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#FF6B00",
          tabBarStyle: {
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom,
            backgroundColor: "#fff",
            elevation: 12,
          },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Accueil", tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }} />
        <Tabs.Screen name="categories" options={{ title: "Catégories", tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} /> }} />
        <Tabs.Screen name="cart" options={{ title: "Panier", tabBarIcon: ({ color, size }) => <Ionicons name="cart" size={size} color={color} /> }} />
        <Tabs.Screen name="messages" options={{ title: "Messages", tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} /> }} />
        <Tabs.Screen name="account" options={{ title: "Compte", tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }} />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: SCREEN_WIDTH * 0.88, borderRadius: 35, padding: 25, alignItems: 'center', borderWidth: 2, borderColor: '#FFD700', elevation: 20 },
  megaTitle: { color: '#FFF', fontSize: 32, fontWeight: '900', textAlign: 'center' },
  megaSubtitle: { color: '#FFD700', fontSize: 14, fontWeight: '700', marginBottom: 5 },
  productRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: 25 },
  productCircle: { width: 85, height: 85, borderRadius: 43, backgroundColor: '#FFF', borderWidth: 3, borderColor: '#FFD700', overflow: 'hidden', elevation: 5 },
  prodImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  priceBadge: { position: 'absolute', bottom: 2, alignSelf: 'center', backgroundColor: '#FFD700', paddingHorizontal: 6, borderRadius: 8 },
  priceBadgeText: { fontSize: 9, fontWeight: '900', color: '#000' },
  actionButton: { backgroundColor: '#FFF', paddingHorizontal: 40, paddingVertical: 14, borderRadius: 30, elevation: 8 },
  actionText: { color: '#CC0000', fontWeight: '900', fontSize: 16 },
  skipBtn: { marginTop: 15 },
  skipText: { color: '#FFF', fontSize: 12, opacity: 0.7, textDecorationLine: 'underline' }
});