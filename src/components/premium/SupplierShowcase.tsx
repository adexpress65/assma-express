import React from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

interface Supplier {
  id: string;
  name: string;
  logo: string;
  description: string;
  location: string;
  verified: boolean;
  products: any[];
  productCount: number;
}

interface SupplierShowcaseProps {
  suppliers: Supplier[];
  title?: string;
  subtitle?: string;
}

const SupplierShowcase: React.FC<SupplierShowcaseProps> = ({ 
  suppliers, 
  title = "Fournisseurs Vérifiés",
  subtitle = "Découvrez nos partenaires de confiance"
}) => {
  const router = useRouter();

  const handleSupplierPress = (supplier: Supplier) => {
    router.push(`/company/${supplier.id}`);
  };

  const handleProductPress = (productId: string) => {
    router.push(`/product/${productId}`);
  };

  if (!suppliers || suppliers.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {suppliers.map((supplier, index) => (
          <TouchableOpacity 
            key={supplier.id}
            style={styles.supplierCard}
            onPress={() => handleSupplierPress(supplier)}
          >
            <LinearGradient
              colors={['#fff', '#f8f9fa']}
              style={styles.gradient}
            >
              {/* En-tête fournisseur */}
              <View style={styles.supplierHeader}>
                <Image 
                  source={{ uri: supplier.logo || 'https://via.placeholder.com/60x60/ff6a00/ffffff?text=F' }} 
                  style={styles.supplierLogo}
                />
                <View style={styles.supplierInfo}>
                  <Text style={styles.supplierName} numberOfLines={1}>
                    {supplier.name}
                  </Text>
                  <Text style={styles.supplierLocation} numberOfLines={1}>
                    📍 {supplier.location || 'Localisation non spécifiée'}
                  </Text>
                  {supplier.verified && (
                    <Text style={styles.verifiedBadge}>✅ Vérifié</Text>
                  )}
                </View>
              </View>

              {/* Produits du fournisseur */}
              <View style={styles.productsSection}>
                <Text style={styles.productsLabel}>
                  {supplier.productCount} produit{supplier.productCount > 1 ? 's' : ''}
                </Text>
                
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.productsScroll}
                >
                  {supplier.products.slice(0, 3).map((product, productIndex) => (
                    <TouchableOpacity 
                      key={product.id}
                      style={styles.productMiniCard}
                      onPress={() => handleProductPress(product.id)}
                    >
                      <Image 
                        source={{ uri: product.imageUrl }} 
                        style={styles.productMiniImage}
                      />
                      <Text style={styles.productMiniPrice}>
                        {product.price?.toLocaleString()} FCFA
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Bouton visiter */}
              <TouchableOpacity 
                style={styles.visitButton}
                onPress={() => handleSupplierPress(supplier)}
              >
                <Text style={styles.visitButtonText}>Visiter la boutique</Text>
              </TouchableOpacity>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 20,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  scrollContent: {
    paddingHorizontal: 12,
  },
  supplierCard: {
    width: 280,
    marginHorizontal: 6,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 8,
  },
  gradient: {
    borderRadius: 12,
    padding: 16,
  },
  supplierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  supplierLogo: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  supplierInfo: {
    flex: 1,
  },
  supplierName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  supplierLocation: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  verifiedBadge: {
    fontSize: 10,
    color: '#28a745',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  productsSection: {
    marginBottom: 12,
  },
  productsLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  productsScroll: {
    flexDirection: 'row',
  },
  productMiniCard: {
    width: 70,
    marginRight: 8,
    alignItems: 'center',
  },
  productMiniImage: {
    width: 60,
    height: 60,
    borderRadius: 6,
    marginBottom: 4,
  },
  productMiniPrice: {
    fontSize: 10,
    color: '#ff6a00',
    fontWeight: '600',
    textAlign: 'center',
  },
  visitButton: {
    backgroundColor: '#ff6a00',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  visitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SupplierShowcase;