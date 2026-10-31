// apps/mobile/src/components/common/SectionBlock.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  title: string;
  showChevron?: boolean;
  onSeeAll?: () => void;
  children: React.ReactNode;
}

export default function SectionBlock({ title, showChevron = true, onSeeAll, children }: Props) {
  return (
    <View style={styles.container}>
      {/* En-tête de section */}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {showChevron && (
          <TouchableOpacity style={styles.seeAllButton} onPress={onSeeAll}>
            <Text style={styles.seeAllText}>Tout voir</Text>
            <Ionicons name="chevron-forward" size={16} color="#FF6A00" />
          </TouchableOpacity>
        )}
      </View>

      {/* Contenu de la section */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222222',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: 14,
    color: '#FF6A00',
    marginRight: 4,
  },
});
