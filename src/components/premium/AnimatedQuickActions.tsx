// src/components/premium/AnimatedQuickActions.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext'; 

const { width } = Dimensions.get('window');

// --- COMPOSANT EFFET ÉTOILES (SPARKLE) ---
const SparkleEffect = ({ isActive }: { isActive: boolean }) => {
  const sparkleAnim = new Animated.Value(0);
  
  useEffect(() => {
    const animateSparkles = () => {
      Animated.sequence([
        Animated.timing(sparkleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(sparkleAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (isActive) {
          setTimeout(animateSparkles, Math.random() * 1000 + 500);
        }
      });
    };
    
    animateSparkles();
    
    return () => {
      sparkleAnim.stopAnimation();
    };
  }, [isActive]);

  return (
    <Animated.View
      style={[
        styles.sparkle,
        {
          opacity: sparkleAnim,
          transform: [
            { scale: sparkleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.2] }) },
            { rotate: sparkleAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }
          ],
        }
      ]}
    >
      <Ionicons name="star" size={8} color="#FFD700" />
    </Animated.View>
  );
};

// --- ACTIONS DE PRODUCTION ---
const QUICK_ACTIONS = [
  {
    id: '1',
    icon: 'flash-outline',
    label: 'quickActions.flashDeal',
    color: ['#ff4444', '#ff6a00'],
    badge: 'quickActions.new',
  },
  {
    id: '2',
    icon: 'trending-up-outline',
    label: 'quickActions.trending',
    color: ['#2196F3', '#21CBF3'],
  },
  {
    id: '4',
    icon: 'business-outline',
    label: 'quickActions.suppliers',
    color: ['#4CAF50', '#66BB6A'],
  },
  {
    id: '5',
    icon: 'storefront-outline',
    label: 'quickActions.wholesale',
    color: ['#9C27B0', '#BA68C8'],
    badge: 'quickActions.new',
  },
  {
    id: 'dash_std',
    icon: 'stats-chart-outline',
    label: 'Gestion Stock',
    color: ['#607D8B', '#90A4AE'],
    isAdminOnly: true,
  },
  {
    id: 'dash_prem',
    icon: 'shield-checkmark-outline',
    label: 'Admin Panel',
    color: ['#FF6B00', '#FF9800'],
    badge: 'PRO',
    isAdminOnly: true,
  },
];

export default function AnimatedQuickActions() {
  const { t } = useTranslation();
  const router = useRouter();
  const { userData } = useAuth(); 
  const [activeButton, setActiveButton] = useState<string | null>(null);

  // ✅ FILTRAGE CORRIGÉ : super-admin, admin, vendeur ou Company
  const filteredActions = useMemo(() => {
    const role = userData?.role;
    
    // Log pour debug en développement
    if (__DEV__) {
      console.log("A2Express Auth Debug - Rôle:", role, "CompanyId:", userData?.companyId);
    }

    const isPrivileged = 
      role === 'super-admin' || 
      role === 'superadmin' || 
      role === 'admin' || 
      role === 'vendeur' ||
      !!userData?.companyId; // Si possède un ID de société

    return QUICK_ACTIONS.filter(action => {
      if (action.isAdminOnly && !isPrivileged) return false;
      return true;
    });
  }, [userData]);

  const handleActionPress = (action: any) => {
    setActiveButton(action.id);
    setTimeout(() => setActiveButton(null), 200);
    
    if (action.id === 'dash_std') {
        router.push('/suppliers/dashboard'); 
        return;
    }
    if (action.id === 'dash_prem') {
        router.push('/seller/dashboard');
        return;
    }

    switch(action.label) {
      case 'quickActions.flashDeal':
        router.push('/flash-deals');
        break;
      case 'quickActions.trending':
        router.push('/trending');
        break;
      case 'quickActions.suppliers':
        router.push({ pathname: "/suppliers", params: { category: "all" } });
        break;
      case 'quickActions.wholesale':
        router.push('/grossiste');
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
        {filteredActions.map((action, index) => (
          <View key={action.id} style={[
            styles.actionWrapper,
            index === filteredActions.length - 1 && styles.lastActionWrapper
          ]}>
            <SparkleEffect isActive={activeButton === action.id} />
            <TouchableOpacity
              style={styles.actionItem}
              activeOpacity={0.7}
              onPress={() => handleActionPress(action)}
            >
              <LinearGradient colors={action.color} style={styles.actionGradient}>
                <Ionicons name={action.icon as any} size={22} color="#fff" />
                {action.badge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                        {action.isAdminOnly ? action.badge : t(action.badge)}
                    </Text>
                  </View>
                )}
              </LinearGradient>
              <Text style={styles.actionLabel} numberOfLines={1}>
                {action.isAdminOnly ? action.label : t(action.label)}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
        <View style={styles.rightSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    marginTop: 30,
    marginBottom: 15,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  scrollContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
    flexGrow: 1,
  },
  actionWrapper: {
    position: 'relative',
    alignItems: 'center',
    marginRight: 20,
    minWidth: 60,
  },
  lastActionWrapper: {
    marginRight: 0,
  },
  rightSpacer: {
    width: 16,
    height: 1,
  },
  sparkle: {
    position: 'absolute',
    zIndex: 1,
  },
  actionItem: {
    alignItems: 'center',
    width: 60,
    zIndex: 2,
  },
  actionGradient: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ff4444',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginTop: 4,
  },
});