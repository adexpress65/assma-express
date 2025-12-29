// src/components/premium/AnimatedQuickActions.tsx - VERSION 100% CORRIGÉE
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const QUICK_ACTIONS = [
  {
    id: '1',
    icon: 'flash-outline',
    label: 'Flash Deal',
    color: ['#ff4444', '#ff6a00'],
    badge: 'Nouveau',
  },
  {
    id: '2',
    icon: 'trending-up-outline',
    label: 'Tendance',
    color: ['#2196F3', '#21CBF3'],
  },
  {
    id: '3',
    icon: 'star-outline',
    label: 'Premium',
    color: ['#FFD700', '#FFA000'],
  },
  {
    id: '4',
    icon: 'business-outline',
    label: 'Fournisseurs',
    color: ['#4CAF50', '#66BB6A'],
  },
  {
    id: '5',
    icon: 'cube-outline',
    label: 'Grossiste',
    color: ['#9C27B0', '#BA68C8'],
  },
  {
    id: '6',
    icon: 'shield-checkmark-outline',
    label: 'Verifié',
    color: ['#607D8B', '#78909C'],
  },
  {
    id: '7',
    icon: 'rocket-outline',
    label: 'Express',
    color: ['#FF9800', '#FFB74D'],
  },
  {
    id: '8',
    icon: 'earth-outline',
    label: 'Global',
    color: ['#00BCD4', '#26C6DA'],
  },
];

export default function AnimatedQuickActions() {
  const router = useRouter();

  // ✅ FONCTION CORRIGÉE - SYNTAXE CORRECTE
  const handleActionPress = (action: any) => {
    console.log('🔄 Navigation action rapide:', action.label);
    
    // ✅ CORRECTION CRITIQUE : switch() avec accolades
    switch(action.label) {
      case 'Flash Deal':
        // ✅ Route vers la page flash deals
        router.push('/flash-deals');
        break;
        
      case 'Tendance':
  // ✅ Navigation directe vers l'écran dédié
  router.push('/trending');
  break;
        
case 'Premium':
  // ✅ Navigation vers les Offres Spéciales
  router.push('/special-offers');
  break;
        
      case 'Fournisseurs':
        router.push({
          pathname: "/suppliers",
          params: { 
            category: "all"
          },
        });
        break;
        
      case 'Grossiste':
        router.push({
          pathname: "/category-products",
          params: { 
            id: "wholesale", 
            name: encodeURIComponent("Grossiste")
          },
        });
        break;
        
      case 'Verifié':
        router.push({
          pathname: "/category-products",
          params: { 
            id: "verified",
            name: encodeURIComponent("Produits Vérifiés")
          },
        });
        break;
        
      case 'Express':
        router.push({
          pathname: "/category-products",
          params: { 
            id: "express",
            name: encodeURIComponent("Livraison Express")
          },
        });
        break;
        
      case 'Global':
        router.push({
          pathname: "/category-products",
          params: { 
            id: "global",
            name: encodeURIComponent("Produits Globaux")
          },
        });
        break;
        
      default:
        router.push("/categories");
        break;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {QUICK_ACTIONS.map((action, index) => (
          <TouchableOpacity
            key={action.id}
            style={styles.actionItem}
            activeOpacity={0.8}
            onPress={() => handleActionPress(action)}
          >
            <LinearGradient
              colors={action.color}
              style={styles.actionGradient}
            >
              <Ionicons name={action.icon as any} size={22} color="#fff" />
              {action.badge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{action.badge}</Text>
                </View>
              )}
            </LinearGradient>
            <Text style={styles.actionLabel} numberOfLines={1}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  scrollContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  actionItem: {
    alignItems: 'center',
    marginRight: 16,
    minWidth: 60,
  },
  actionGradient: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ff4444',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
});