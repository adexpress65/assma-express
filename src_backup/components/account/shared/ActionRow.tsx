// apps/mobile/src/components/account/shared/ActionRow.tsx
import React, { ReactElement } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

interface ActionRowProps {
  title: string;
  icon: string;
  color: string;
  count?: number;
  onPress: () => void;
  description?: string;
}

const ActionRow = ({ title, icon, color, count, onPress, description }: ActionRowProps) => {
  const getIconComponent = (iconName: string): ReactElement => {
    const iconMap: Record<string, ReactElement> = {
      'heart': <Ionicons name="heart-outline" size={22} color={color} />,
      'time': <Ionicons name="time-outline" size={22} color={color} />,
      'wallet': <Ionicons name="wallet-outline" size={22} color={color} />,
      'location': <Ionicons name="location-outline" size={22} color={color} />,
      'business': <Ionicons name="business-outline" size={22} color={color} />,
      'search': <Ionicons name="search-outline" size={22} color={color} />,
      'settings': <Ionicons name="settings-outline" size={22} color={color} />,
      'help-circle': <Ionicons name="help-circle-outline" size={22} color={color} />,
      'store': <MaterialIcons name="store" size={22} color={color} />,
      'sourcing': <FontAwesome5 name="hands-helping" size={18} color={color} />,
      'orders': <MaterialIcons name="shopping-bag" size={22} color={color} />,
      'messages': <Ionicons name="chatbubble-outline" size={22} color={color} />,
    };
    return iconMap[icon] || <Ionicons name="help-circle-outline" size={22} color={color} />;
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.leftSection}>
        <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
          {getIconComponent(icon)}
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          {description && <Text style={styles.description}>{description}</Text>}
        </View>
      </View>
      <View style={styles.rightSection}>
        {count !== undefined && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={18} color="#ccc" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    marginBottom: 2,
  },
  description: {
    fontSize: 12,
    color: '#666',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countBadge: {
    backgroundColor: '#ff4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  countText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default ActionRow;