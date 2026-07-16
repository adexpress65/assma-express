import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

// ===================== AJOUTEZ CES DÃƒâ€°CLARATIONS DE TYPE =====================
// DÃƒÂ©claration globale pour ÃƒÂ©tendre les types de React Navigation
declare global {
  namespace ReactNavigation {
    interface RootParamList {
      // Routes super-admin
      "/super-admin/dashboard": undefined;
      "/super-admin/users": undefined;
      "/super-admin/verifications": undefined;
      "/super-admin/reports": undefined;
      "/super-admin/settings": undefined;
      
      // Routes seller
      "/seller/dashboard": undefined;
      "/seller/orders": undefined;
      "/seller/orders/[id]": { id: string };
      "/seller/add-product": undefined;
      "/seller/analytics": undefined;
      "/seller/promotions": undefined;
      "/seller/profile": undefined;
      
      // Routes auth
      "/login": undefined;
      "/register": undefined;
      "/forgot-password": undefined;
      
      // Routes principales
      "/": undefined;
      "/(tabs)": undefined;
      "/(tabs)/index": undefined;
      "/(tabs)/cart": undefined;
      "/(tabs)/profile": undefined;
      "/become-seller": undefined;
      
      // Routes produits
      "/product/[id]": { id: string };
      "/category/[id]": { id: string };
      "/search-results": undefined;
      
      // Ajoutez ici toutes les autres routes que vous utilisez
    }
  }
}

// DÃƒÂ©claration pour Expo Router
declare module 'expo-router' {
  export interface RelativePathString extends String {}
  export interface ExternalPathString extends String {}
}

// ===================== FIN DES DÃƒâ€°CLARATIONS =====================

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Oops! Not Found' }} />
      
      <View style={styles.content}>
        <Text style={styles.title}>This screen doesn't exist.</Text>
        <Text style={styles.subtitle}>
          The page you are looking for could not be found.
        </Text>
        
        <Link href="/(tabs)" asChild>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Go to home screen!</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
