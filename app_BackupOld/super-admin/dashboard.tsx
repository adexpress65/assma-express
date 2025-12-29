import React from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  SafeAreaView, 
  StyleSheet, 
  TouchableOpacity 
} from 'react-native';
import { useRouter } from 'expo-router'; // âœ… AJOUTER CET IMPORT

// Composant StatsCard
function StatsCard({ title, value }: { title: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );
}

// Composant QuickActions
function QuickActions({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.quickActions}>
      {children}
    </View>
  );
}

// Composant Button
function Button({ title, onPress }: { title: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
}

// Composant RecentProducts
function RecentProducts() {
  const recentProducts = [
    { id: 1, name: 'iPhone 15 Pro', price: '1299â‚¬', seller: 'TechWorld' },
    { id: 2, name: 'Samsung S24', price: '1199â‚¬', seller: 'MobileExpert' },
    { id: 3, name: 'MacBook Pro', price: '2499â‚¬', seller: 'TechWorld' },
  ];

  return (
    <View style={styles.recentProducts}>
      <Text style={styles.sectionTitle}>Produits RÃ©cents</Text>
      {recentProducts.map((product) => (
        <View key={product.id} style={styles.productItem}>
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productSeller}>{product.seller}</Text>
          </View>
          <Text style={styles.productPrice}>{product.price}</Text>
        </View>
      ))}
    </View>
  );
}

// Composant principal
export default function SuperAdminDashboard() {
  const router = useRouter(); // âœ… DÃ‰CLARER LE ROUTER ICI

  const handleAddProduct = () => {
    console.log('Ajouter produit global');
    router.push('/seller/add-product'); // âœ… CORRECTION ICI
  };

  const handleManageSellers = () => {
    console.log('GÃ©rer les vendeurs');
    // router.push('/super-admin/manage-sellers');
  };

  const handleViewStats = () => {
    console.log('Voir les statistiques');
    // router.push('/super-admin/analytics');
  };

  const handlePlatformSettings = () => {
    console.log('ParamÃ¨tres plateforme');
    // router.push('/super-admin/settings');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Tableau de Bord Super Admin</Text>
          <Text style={styles.subtitle}>ASMA Express - Administration</Text>
        </View>

        {/* Statistiques globales */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Statistiques Globales</Text>
          <View style={styles.statsGrid}>
            <StatsCard title="Total Ventes" value="125Kâ‚¬" />
            <StatsCard title="Vendeurs Actifs" value="45" />
            <StatsCard title="Produits" value="1,250" />
            <StatsCard title="Commandes" value="890" />
          </View>
        </View>
        
        {/* Actions rapides */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Actions Rapides</Text>
          <QuickActions>
            <Button title="âž• Ajouter Produit Global" onPress={handleAddProduct} />
            <Button title="ðŸ‘¥ GÃ©rer Vendeurs" onPress={handleManageSellers} />
            <Button title="ðŸ“Š Voir Statistiques" onPress={handleViewStats} />
            <Button title="âš™ï¸ ParamÃ¨tres Plateforme" onPress={handlePlatformSettings} />
          </QuickActions>
        </View>
        
        {/* Produits rÃ©cents */}
        <RecentProducts />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6c757d',
  },
  statsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: '45%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
  },
  actionsSection: {
    padding: 16,
  },
  quickActions: {
    gap: 12,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  recentProducts: {
    padding: 16,
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212529',
    marginBottom: 4,
  },
  productSeller: {
    fontSize: 14,
    color: '#6c757d',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#28a745',
  },
});

