// app/super-admin/create-sample-product.tsx - CODE COMPLET
import React, { useState, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, Alert, ActivityIndicator, 
  StyleSheet, ScrollView 
} from 'react-native';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function CreateSampleProduct() {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const categoriesSnapshot = await getDocs(collection(db, 'categories'));
      const categoriesList = categoriesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCategories(categoriesList);
      console.log('Ã°Å¸â€œâ€¹ CatÃƒÂ©gories chargÃƒÂ©es:', categoriesList);
    } catch (error) {
      console.error('Erreur chargement catÃƒÂ©gories:', error);
    }
  };

  const createSampleProduct = async () => {
    if (!selectedCategory) {
      Alert.alert('Erreur', 'Veuillez sÃƒÂ©lectionner une catÃƒÂ©gorie');
      return;
    }

    setLoading(true);
    try {
      const productData = {
        name: "Presse Hydraulique Industrielle 50T",
        description: "Presse hydraulique professionnelle 50 tonnes pour travaux industriels lourds. IdÃƒÂ©ale pour la mÃƒÂ©tallurgie et la construction. FabriquÃƒÂ©e avec des matÃƒÂ©riaux de haute qualitÃƒÂ© pour une durabilitÃƒÂ© exceptionnelle.",
        price: 28500,
        originalPrice: 32000,
        category: selectedCategory.name,
        categoryId: selectedCategory.id,
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
        weight: "850 kg",
        dimensions: "120x80x150 cm",
        hasVariants: false,
        features: ["50 tonnes capacitÃƒÂ©", "ContrÃƒÂ´le numÃƒÂ©rique", "SÃƒÂ©curitÃƒÂ© renforcÃƒÂ©e"],
        warranty: "2 ans",
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await addDoc(collection(db, 'products'), productData);
      
      Alert.alert(
        'Ã°Å¸Å½â€° SuccÃƒÂ¨s !', 
        `Produit crÃƒÂ©ÃƒÂ© avec ID: ${docRef.id}\n\nIl devrait apparaÃƒÂ®tre dans:\nÃ¢â‚¬Â¢ L'accueil\nÃ¢â‚¬Â¢ La section Machines Industrielles\nÃ¢â‚¬Â¢ Les produits tendances`,
        [
          { 
            text: 'Voir l\'accueil', 
            onPress: () => router.push('/(tabs)') 
          },
          { 
            text: 'CrÃƒÂ©er un autre', 
            style: 'cancel',
            onPress: () => setSelectedCategory(null)
          }
        ]
      );

      console.log('Ã¢Å“â€¦ Produit crÃƒÂ©ÃƒÂ©:', productData);

    } catch (error) {
      console.error('Ã¢ÂÅ’ Erreur crÃƒÂ©ation produit:', error);
      Alert.alert('Erreur', 'Impossible de crÃƒÂ©er le produit. VÃƒÂ©rifiez la console.');
    } finally {
      setLoading(false);
    }
  };

  const createMultipleSamples = async () => {
    if (!selectedCategory) {
      Alert.alert('Erreur', 'Veuillez sÃƒÂ©lectionner une catÃƒÂ©gorie');
      return;
    }

    setLoading(true);
    try {
      const sampleProducts = [
        {
          name: "Presse Hydraulique Industrielle 50T",
          description: "Presse hydraulique professionnelle 50 tonnes",
          price: 28500,
          originalPrice: 32000,
          category: selectedCategory.name,
          categoryId: selectedCategory.id,
          imageUrl: "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=400&h=300&fit=crop",
          supplier: "Global Machinery Corp",
          stock: 8,
          isVerified: true,
          isActive: true,
          rating: 4.8,
          orders: 1247,
          createdAt: new Date(),
        },
        {
          name: "Tour CNC Professionnel Haute PrÃƒÂ©cision",
          description: "Tour ÃƒÂ  commande numÃƒÂ©rique pour usinage de prÃƒÂ©cision",
          price: 42000,
          originalPrice: 48000,
          category: selectedCategory.name,
          categoryId: selectedCategory.id,
          imageUrl: "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=400&h=300&fit=crop",
          supplier: "Precision Tools Ltd",
          stock: 5,
          isVerified: true,
          isActive: true,
          rating: 4.9,
          orders: 892,
          createdAt: new Date(),
        },
        {
          name: "Soudeuse Automatique MIG/MAG 400A",
          description: "Soudeuse automatique professionnelle 400 ampÃƒÂ¨res",
          price: 18700,
          originalPrice: 21000,
          category: selectedCategory.name,
          categoryId: selectedCategory.id,
          imageUrl: "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=400&h=300&fit=crop",
          supplier: "WeldTech Industries",
          stock: 12,
          isVerified: true,
          isActive: true,
          rating: 4.6,
          orders: 567,
          createdAt: new Date(),
        }
      ];

      for (const product of sampleProducts) {
        await addDoc(collection(db, 'products'), {
          ...product,
          minOrder: 1,
          deliveryTime: "10-15 jours",
          views: Math.floor(Math.random() * 5000) + 1000,
          sku: `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          weight: "Variable",
          dimensions: "Variable",
          hasVariants: false,
          updatedAt: new Date()
        });
      }

      Alert.alert(
        'Ã°Å¸Å½â€° 3 Produits CrÃƒÂ©ÃƒÂ©s !', 
        '3 produits d\'exemple ont ÃƒÂ©tÃƒÂ© crÃƒÂ©ÃƒÂ©s et devraient apparaÃƒÂ®tre dans votre application.',
        [
          { 
            text: 'Voir l\'accueil', 
            onPress: () => router.push('/(tabs)') 
          }
        ]
      );

    } catch (error) {
      console.error('Erreur crÃƒÂ©ation multiple:', error);
      Alert.alert('Erreur', 'Impossible de crÃƒÂ©er les produits');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CrÃƒÂ©er Produits Test</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.title}>CrÃƒÂ©ation de Produits Test</Text>
        <Text style={styles.subtitle}>
          Cette page crÃƒÂ©e des produits d'exemple dans Firestore pour tester votre application.
        </Text>

        {/* SÃƒÂ©lection de catÃƒÂ©gorie */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SÃƒÂ©lectionnez une CatÃƒÂ©gorie</Text>
          {categories.map(category => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryButton,
                selectedCategory?.id === category.id && styles.categoryButtonSelected
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[
                styles.categoryText,
                selectedCategory?.id === category.id && styles.categoryTextSelected
              ]}>
                {category.name}
              </Text>
              {selectedCategory?.id === category.id && (
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {selectedCategory && (
          <View style={styles.section}>
            <Text style={styles.selectedCategory}>
              CatÃƒÂ©gorie sÃƒÂ©lectionnÃƒÂ©e: <Text style={styles.categoryName}>{selectedCategory.name}</Text>
            </Text>

            {/* Bouton produit simple */}
            <TouchableOpacity 
              style={[styles.button, styles.primaryButton]} 
              onPress={createSampleProduct}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="cube-outline" size={20} color="#FFF" />
                  <Text style={styles.buttonText}>CrÃƒÂ©er 1 Produit Test</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Bouton multiple produits */}
            <TouchableOpacity 
              style={[styles.button, styles.secondaryButton]} 
              onPress={createMultipleSamples}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="layers-outline" size={20} color="#FFF" />
                  <Text style={styles.buttonText}>CrÃƒÂ©er 3 Produits Test</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={24} color="#2196F3" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Ãƒâ‚¬ savoir</Text>
            <Text style={styles.infoText}>
              Ã¢â‚¬Â¢ Les produits seront crÃƒÂ©ÃƒÂ©s dans la collection "products"{'\n'}
              Ã¢â‚¬Â¢ Ils seront immÃƒÂ©diatement visibles dans l'app{'\n'}
              Ã¢â‚¬Â¢ Parfait pour tester les sections tendances et catÃƒÂ©gories
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 20,
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
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  categoryButtonSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196F3',
  },
  categoryText: {
    fontSize: 16,
    color: '#333',
  },
  categoryTextSelected: {
    color: '#2196F3',
    fontWeight: '600',
  },
  selectedCategory: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  categoryName: {
    fontWeight: 'bold',
    color: '#ff6a00',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    gap: 10,
  },
  primaryButton: {
    backgroundColor: '#ff6a00',
  },
  secondaryButton: {
    backgroundColor: '#2196F3',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 5,
  },
  infoText: {
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
});
