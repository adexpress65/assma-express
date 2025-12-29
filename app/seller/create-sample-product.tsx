// app/super-admin/create-sample-product.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useRouter } from 'expo-router';

export default function CreateSampleProduct() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const createSampleProduct = async () => {
    setLoading(true);
    try {
      // Remplacez par l'ID rÃƒÂ©el de votre catÃƒÂ©gorie "Machines Industrielles"
      const categoryId = "lYoFrEOE7DNKP2d4UAnZ"; // Ãƒâ‚¬ modifier selon votre ID

      const productData = {
        name: "Presse Hydraulique Industrielle 50T",
        description: "Presse hydraulique professionnelle 50 tonnes pour travaux industriels lourds. IdÃƒÂ©ale pour la mÃƒÂ©tallurgie et la construction.",
        price: 28500,
        originalPrice: 32000,
        category: "Machines Industrielles",
        categoryId: categoryId,
        imageUrl: "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=400&h=300&fit=crop",
        imageUrls: [
          "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=400&h=300&fit=crop",
          "https://images.unsplash.com/photo-1581091226033-d5c48150dbaa?w=400&h=300&fit=crop"
        ],
        supplier: "Global Machinery Corp",
        stock: 8,
        minOrder: 1,
        deliveryTime: "15-20 jours",
        isVerified: true,
        isActive: true,
        rating: 4.8,
        orders: 1247,
        views: 5689,
        sku: "PRESS-HYDRO-50T",
        weight: "850",
        dimensions: "120x80x150 cm",
        hasVariants: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await addDoc(collection(db, 'products'), productData);
      
      Alert.alert(
        'SuccÃƒÂ¨s !', 
        `Produit crÃƒÂ©ÃƒÂ© avec ID: ${docRef.id}\nIl devrait apparaÃƒÂ®tre dans l'accueil maintenant.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );

    } catch (error) {
      console.error('Erreur crÃƒÂ©ation produit:', error);
      Alert.alert('Erreur', 'Impossible de crÃƒÂ©er le produit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>CrÃƒÂ©er un Produit Test</Text>
      <Text style={styles.subtitle}>
        Ceci crÃƒÂ©era un produit exemple dans la collection "products"
      </Text>
      
      <TouchableOpacity 
        style={styles.button} 
        onPress={createSampleProduct}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.buttonText}>CrÃƒÂ©er le Produit Test</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, styles.secondaryButton]} 
        onPress={() => router.back()}
      >
        <Text style={styles.secondaryButtonText}>Retour</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#ff6a00',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ff6a00',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButtonText: {
    color: '#ff6a00',
    fontSize: 16,
    fontWeight: 'bold',
  },
});