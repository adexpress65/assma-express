// src/components/premium/PremiumTabHeader.tsx - VERSION AVEC DISABLE
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const TABS = [
  { id: 'recommended', label: 'Recommandé', count: 1245 },
  { id: 'trending', label: 'Tendance', count: 892 },
  { id: 'new', label: 'Nouveautés', count: 567 },
  { id: 'premium', label: 'Premium', count: 345 },
  { id: 'flash', label: 'Flash Deal', count: 234 },
];

interface PremiumTabHeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  disabled?: boolean; // ✅ NOUVELLE PROP
}

export default function PremiumTabHeader({ 
  activeTab, 
  onTabChange,
  disabled = false // ✅ VALEUR PAR DÉFAUT
}: PremiumTabHeaderProps) {
  const router = useRouter();

  const handleTabPress = (tabId: string) => {
    if (disabled) return; // ✅ EMPÊCHE L'ACTION SI DÉSACTIVÉ
    onTabChange(tabId);
    // Navigation selon l'onglet
    switch(tabId) {
      case 'recommended':
        router.push('/recommended');
        break;
      case 'trending':
        router.push('/trending');
        break;
      case 'new':
        router.push('/new-arrivals');
        break;
      case 'premium':
        router.push('/premium-products');
        break;
      case 'flash':
        router.push('/flash-deals');
        break;
      default:
        router.push('/products');
    }
  };

  // ✅ RETOURNE NULL SI DÉSACTIVÉ
  if (disabled) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContainer}
      >
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              activeTab === tab.id && styles.activeTab,
              disabled && styles.disabledTab, // ✅ STYLE DÉSACTIVÉ
            ]}
            onPress={() => handleTabPress(tab.id)}
            disabled={disabled} // ✅ DÉSACTIVE LE TOUCH
          >
            {activeTab === tab.id ? (
              <LinearGradient
                colors={['#ff6a00', '#ff8c00']}
                style={styles.activeTabGradient}
              >
                <Text style={styles.activeTabText}>{tab.label}</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{tab.count}</Text>
                </View>
              </LinearGradient>
            ) : (
              <>
                <Text style={[
                  styles.tabText,
                  disabled && styles.disabledTabText // ✅ TEXTE DÉSACTIVÉ
                ]}>{tab.label}</Text>
                <View style={styles.inactiveCountBadge}>
                  <Text style={styles.inactiveCountText}>{tab.count}</Text>
                </View>
              </>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tabsContainer: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  tab: {
    marginRight: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
  disabledTab: {
    opacity: 0.5,
  },
  activeTab: {
    shadowColor: '#ff6a00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  activeTabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  activeTabText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 6,
  },
  countBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  tabText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  disabledTabText: {
    color: '#999',
  },
  inactiveCountBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ff6a00',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
  },
  inactiveCountText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
  },
});