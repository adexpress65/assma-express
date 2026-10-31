import React, { useState, useEffect } from "react";
import { 
  ScrollView, 
  StyleSheet, 
  StatusBar, 
  View, 
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, limit, query, where, orderBy } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { db } from "../../src/config/firebase";
import { useAuth } from "../../src/contexts/AuthContext";
import Header from "../../src/components/common/Header";
import QuickActions from "../../src/components/common/QuickActions";
import AdBanner from "../../src/components/home/AdBanner";
import TabHeader from "../../src/components/home/TabHeader";
import PromoBanner from "../../src/components/home/PromoBanner";
import ProductGrid from "../../src/components/home/ProductGrid";
import NewArrivals from "../../src/components/home/NewArrivals";

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  seller: string;
  sellerId: string;
  rating: number;
  sales: number;
  wholesalePrice?: number;
  minOrder: number;
  isPremium: boolean;
  status: 'approved' | 'pending' | 'rejected';
  createdAt: any;
}

const SectionTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <View style={sectionStyles.container}>
    <Text style={sectionStyles.title}>{title}</Text>
    {subtitle && <Text style={sectionStyles.subtitle}>{subtitle}</Text>}
  </View>
);

const FlashSales = ({ products }: { products: Product[] }) => {
  const router = useRouter();
  
  return (
    <View style={tempStyles.container}>
      <SectionTitle 
        title="? Soldes Flash" 
        subtitle="Offres limitÃ©es - DÃ©pÃªchez-vous !"
      />
      {products.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {products.slice(0, 5).map(product => (
            <TouchableOpacity 
              key={product.id}
              style={tempStyles.productCard}
              onPress={() => router.push({ pathname: `/products/${product.id}` } as any)}
            >
              <View style={tempStyles.productImage}>
                <Text style={tempStyles.emoji}>??</Text>
              </View>
              <Text style={tempStyles.productName} numberOfLines={2}>
                {product.name}
              </Text>
              <Text style={tempStyles.productPrice}>{product.price}â‚¬</Text>
              {product.originalPrice && (
                <Text style={tempStyles.originalPrice}>{product.originalPrice}â‚¬</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <Text style={tempStyles.placeholder}>
          ?? Aucun produit en solde
        </Text>
      )}
    </View>
  );
};

const TrendingProducts = ({ products }: { products: Product[] }) => {
  const router = useRouter();
  
  return (
    <View style={tempStyles.container}>
      <SectionTitle 
        title="?? Produits Tendances" 
        subtitle="Les plus populaires cette semaine"
      />
      {products.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {products.slice(0, 5).map(product => (
            <TouchableOpacity 
              key={product.id}
              style={tempStyles.productCard}
              onPress={() => router.push({ pathname: `/products/${product.id}` } as any)}
            >
              <View style={tempStyles.productImage}>
                <Text style={tempStyles.emoji}>??</Text>
              </View>
              <Text style={tempStyles.productName} numberOfLines={2}>
                {product.name}
              </Text>
              <Text style={tempStyles.productPrice}>{product.price}â‚¬</Text>
              <Text style={tempStyles.sales}>?? {product.sales} ventes</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <Text style={tempStyles.placeholder}>
          ?? Aucun produit tendance
        </Text>
      )}
    </View>
  );
};

const PremiumSuppliers = ({ products }: { products: Product[] }) => (
  <View style={tempStyles.container}>
    <SectionTitle 
      title="?? Fournisseurs Premium" 
      subtitle="Vendeurs vÃ©rifiÃ©s ASMA Express"
    />
    <Text style={tempStyles.placeholder}>
      ?? {products.length} fournisseurs premium
    </Text>
  </View>
);

const WholesalePayment = () => (
  <View style={tempStyles.container}>
    <SectionTitle 
      title="?? Paiement Grossiste" 
      subtitle="Tarifs professionnels exclusifs"
    />
    <Text style={tempStyles.placeholder}>
      ?? AccÃ¨s aux prix grossiste
    </Text>
  </View>
);

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [premiumProducts, setPremiumProducts] = useState<Product[]>([]);
  const [flashSales, setFlashSales] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const { user, userRole } = useAuth();
  const router = useRouter();

  const loadFirebaseData = async () => {
    try {
      setLoading(true);

      const approvedProductsQuery = query(
        collection(db, 'products'),
        where('status', '==', 'approved'),
        orderBy('createdAt', 'desc')
      );
      
      const productsSnapshot = await getDocs(approvedProductsQuery);
      const allProducts = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];

      if (allProducts.length === 0) {
        console.log('?? Aucun produit approuvÃ© trouvÃ©');
        setTrendingProducts([]);
        setPremiumProducts([]);
        setFlashSales([]);
        setNewArrivals([]);
        return;
      }

      const trending = [...allProducts]
        .sort((a, b) => (b.sales || 0) - (a.sales || 0))
        .slice(0, 8);
      setTrendingProducts(trending);

      const premium = allProducts.filter(product => product.isPremium).slice(0, 6);
      setPremiumProducts(premium);

      const flash = allProducts.filter(product => product.originalPrice && product.originalPrice > product.price).slice(0, 6);
      setFlashSales(flash);

      const newProducts = [...allProducts]
        .sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis())
        .slice(0, 8);
      setNewArrivals(newProducts);

    } catch (error) {
      console.error('Erreur chargement Firebase:', error);
      setTrendingProducts([]);
      setPremiumProducts([]);
      setFlashSales([]);
      setNewArrivals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFirebaseData();
  }, []);

  const DashboardButton = () => {
    if (!user || (userRole !== 'admin' && userRole !== 'seller' && userRole !== 'super-admin')) {
      return null;
    }

    const getDashboardLabel = () => {
      switch (userRole) {
       case 'super-admin': return <Text>Super Admin</Text>;
case 'admin': return <Text>Admin</Text>;
case 'seller': return <Text>Vendeur</Text>;
default: return <Text>Dashboard</Text>;
      }
    };

    const getDashboardPath = () => {
      switch (userRole) {
        case 'super-admin': return <Text>Super Admin</Text>;
case 'admin': return <Text>Admin</Text>;
case 'seller': return <Text>Vendeur</Text>;
default: return <Text>Dashboard</Text>;
      }
    };

    const navigateToDashboard = () => {
      router.push({ pathname: getDashboardPath() } as any);
    };

    return (
      <TouchableOpacity 
        style={tempStyles.dashboardButton}
        onPress={navigateToDashboard}
      >
        <Ionicons name="speedometer" size={16} color="#fff" />
        <Text style={tempStyles.dashboardButtonText}>
          ?? {getDashboardLabel()}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff6a00" />
        <Text style={styles.loadingText}>Chargement ASMA Express...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#ff6a00" barStyle="light-content" />
      <Header />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <DashboardButton />
        <AdBanner />
        <QuickActions
          onExplore={() => console.log("Explorer")}
          onQuote={() => console.log("Devis")}
        />
        <TabHeader />
        <PromoBanner />
        <FlashSales products={flashSales} />
        <TrendingProducts products={trendingProducts} />
        <WholesalePayment />
        <PremiumSuppliers products={premiumProducts} />
        <NewArrivals />
        <ProductGrid />
        <View style={styles.finalSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  finalSpacer: {
    height: 30,
  },
});

const tempStyles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    marginHorizontal: 12,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  placeholder: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingVertical: 20,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
    width: 140,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  productImage: {
    width: 60,
    height: 60,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    alignSelf: 'center',
  },
  emoji: {
    fontSize: 24,
  },
  productName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  productPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ff6a00',
    textAlign: 'center',
  },
  originalPrice: {
    fontSize: 11,
    color: '#999',
    textDecorationLine: 'line-through',
    textAlign: 'center',
  },
  sales: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  dashboardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    margin: 16,
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    gap: 8,
  },
  dashboardButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

const sectionStyles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
});
