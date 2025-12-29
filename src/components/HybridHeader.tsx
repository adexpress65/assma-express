// src/components/HybridHeader.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TabType, UnreadCounts } from '../types';

interface HybridHeaderProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isSearchVisible: boolean;
  onSearchVisibilityChange: (visible: boolean) => void;
  unreadCounts: UnreadCounts;
}

export const HybridHeader: React.FC<HybridHeaderProps> = ({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  isSearchVisible,
  onSearchVisibilityChange,
  unreadCounts,
}) => {
  const [animation] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    Animated.timing(animation, {
      toValue: isSearchVisible ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isSearchVisible]);

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'social', label: 'Social', icon: 'chatbubble-ellipses' },
    { id: 'business', label: 'Business', icon: 'business' },
    { id: 'shopping', label: 'Shopping', icon: 'cart' },
  ];

  const searchBarHeight = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 56],
  });

  const contentOpacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  return (
    <View style={styles.container}>
      {/* Barre de recherche animée */}
      <Animated.View 
        style={[styles.searchContainer, { height: searchBarHeight }]}
      >
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher des messages..."
            value={searchQuery}
            onChangeText={onSearchChange}
            autoFocus={isSearchVisible}
          />
          <TouchableOpacity
            onPress={() => onSearchVisibilityChange(false)}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Header principal */}
      <Animated.View 
        style={[styles.headerContent, { opacity: contentOpacity }]}
        pointerEvents={isSearchVisible ? 'none' : 'auto'}
      >
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Messages</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => onSearchVisibilityChange(true)}
              style={styles.actionButton}
            >
              <Ionicons name="search" size={24} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="add" size={24} color="#000" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Onglets */}
        <View style={styles.tabsContainer}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const unreadCount = unreadCounts[tab.id];

            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tab, isActive && styles.activeTab]}
                onPress={() => onTabChange(tab.id)}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={20}
                  color={isActive ? '#007AFF' : '#666'}
                />
                <Text
                  style={[
                    styles.tabText,
                    isActive && styles.activeTabText,
                  ]}
                >
                  {tab.label}
                </Text>
                {unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
                {isActive && <View style={styles.activeIndicator} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  searchContainer: {
    overflow: 'hidden',
    paddingHorizontal: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    flex: 1,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 16,
    color: '#000',
  },
  closeButton: {
    padding: 4,
  },
  headerContent: {
    paddingTop: Platform.OS === 'ios' ? 10 : 16,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#000',
  },
  actions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginHorizontal: 4,
    borderRadius: 20,
    position: 'relative',
  },
  activeTab: {
    backgroundColor: '#F2F2F7',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 6,
  },
  activeTabText: {
    color: '#007AFF',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FF3B30',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    width: '40%',
    backgroundColor: '#007AFF',
    borderRadius: 1.5,
  },
});