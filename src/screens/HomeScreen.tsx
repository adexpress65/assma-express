// apps/mobile/src/screens/HomeScreen.tsx
import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Image, 
  TouchableOpacity, 
  SafeAreaView,
  Dimensions 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const HomeScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      {/* Header avec barre de recherche */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MaBoutique</Text>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#777" />
          <Text style={styles.searchPlaceholder}>Rechercher un produit...</Text>
        </View>
      </View>
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Catégories */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.categories}
        >
          <View style={styles.category}>
            <View style={styles.categoryIcon}>
              <Ionicons name="shirt-outline" size={24} color="#555" />
            </View>
            <Text style={styles.categoryText}>Mode</Text>
          </View>
          
          <View style={styles.category}>
            <View style={styles.categoryIcon}>
              <Ionicons name="phone-portrait-outline" size={24} color="#555" />
            </View>
            <Text style={styles.categoryText}>Téléphone</Text>
          </View>
          
          <View style={styles.category}>
            <View style={styles.categoryIcon}>
              <Ionicons name="laptop-outline" size={24} color="#555" />
            </View>
            <Text style={styles.categoryText}>Électronique</Text>
          </View>
          
          <View style={styles.category}>
            <View style={styles.categoryIcon}>
              <Ionicons name="home-outline" size={24} color="#555" />
            </View>
            <Text style={styles.categoryText}>Maison</Text>
          </View>
          
          <View style={styles.category}>
            <View style={styles.categoryIcon}>
              <Ionicons name="car-sport-outline" size={24} color="#555" />
            </View>
            <Text style={styles.categoryText}>Auto</Text>
          </View>
          
          <View style={styles.category}>
            <View style={styles.categoryIcon}>
              <Ionicons name="game-controller-outline" size={24} color="#555" />
            </View>
            <Text style={styles.categoryText}>Jeux</Text>
          </View>
        </ScrollView>
        
        {/* Bannière promo */}
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Jusqu'à -60%</Text>
          <Text style={styles.bannerText}>Valable uniquement sur les articles sélectionnés</Text>
        </View>
        
        {/* Grille de produits */}
        <View style={styles.productGrid}>
          {/* Produit 1 */}
          <TouchableOpacity style={styles.productCard}>
            <Image 
              source={{ uri: 'https://via.placeholder.com/200x150?text=Produit' }} 
              style={styles.productImage}
            />
            <View style={styles.productInfo}>
              <View style={styles.priceContainer}>
                <Text style={styles.productPrice}>XOF 210,197</Text>
                <Text style={styles.originalPrice}>XOF 271,827</Text>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>-22%</Text>
                </View>
              </View>
              <Text style={styles.soldCount}>+482 vendus</Text>
            </View>
          </TouchableOpacity>
          
          {/* Produit 2 */}
          <TouchableOpacity style={styles.productCard}>
            <Image 
              source={{ uri: 'https://via.placeholder.com/200x150?text=Produit' }} 
              style={styles.productImage}
            />
            <View style={styles.productInfo}>
              <View style={styles.priceContainer}>
                <Text style={styles.productPrice}>XOF 166,531</Text>
                <Text style={styles.originalPrice}>XOF 208,751</Text>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>-20%</Text>
                </View>
              </View>
              <Text style={styles.soldCount}>+503 vendus</Text>
            </View>
          </TouchableOpacity>
          
          {/* Produit 3 */}
          <TouchableOpacity style={styles.productCard}>
            <Image 
              source={{ uri: 'https://via.placeholder.com/200x150?text=iPhone' }} 
              style={styles.productImage}
            />
            <View style={styles.productInfo}>
              <View style={styles.priceContainer}>
                <Text style={styles.productPrice}>XOF 513,000</Text>
                <Text style={styles.originalPrice}>XOF 1,350,000</Text>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>-62%</Text>
                </View>
              </View>
              <Text style={styles.soldCount}>+482 vendus</Text>
              <Text style={styles.productName}>iPhone 15 Pro</Text>
            </View>
          </TouchableOpacity>
          
          {/* Produit 4 */}
          <TouchableOpacity style={styles.productCard}>
            <Image 
              source={{ uri: 'https://via.placeholder.com/200x150?text=Galaxy' }} 
              style={styles.productImage}
            />
            <View style={styles.productInfo}>
              <View style={styles.priceContainer}>
                <Text style={styles.productPrice}>XOF 302,000</Text>
                <Text style={styles.originalPrice}>XOF 604,000</Text>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>-50%</Text>
                </View>
              </View>
              <Text style={styles.soldCount}>+503 vendus</Text>
              <Text style={styles.productName}>Samsung Galaxy S23</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#ff3f34',
    padding: 15,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 4,
    padding: 10,
  },
  searchPlaceholder: {
    marginLeft: 10,
    color: '#777',
    fontSize: 16,
  },
  categories: {
    backgroundColor: 'white',
    paddingVertical: 15,
    paddingHorizontal: 10,
  },
  category: {
    alignItems: 'center',
    marginHorizontal: 10,
    width: 60,
  },
  categoryIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  categoryText: {
    fontSize: 12,
    color: '#555',
    textAlign: 'center',
  },
  banner: {
    backgroundColor: '#ff3f34',
    padding: 20,
    marginVertical: 10,
    alignItems: 'center',
  },
  bannerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  bannerText: {
    color: 'white',
    fontSize: 14,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 10,
  },
  productCard: {
    width: width / 2 - 15,
    backgroundColor: 'white',
    borderRadius: 10,
    marginBottom: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  productImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  productInfo: {
    padding: 10,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 5,
  },
  productPrice: {
    color: '#ff3f34',
    fontWeight: 'bold',
    marginRight: 5,
    fontSize: 14,
  },
  originalPrice: {
    textDecorationLine: 'line-through',
    color: '#999',
    fontSize: 12,
    marginRight: 5,
  },
  discountBadge: {
    backgroundColor: '#ff3f34',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  discountText: {
    color: 'white',
    fontSize: 12,
  },
  soldCount: {
    fontSize: 12,
    color: '#777',
    marginTop: 3,
  },
  productName: {
    fontSize: 14,
    marginTop: 3,
  },
});

export default HomeScreen;
