// apps/mobile/src/components/account/ServicesSection.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ServicesSectionProps {
  onServicePress: (serviceName: string) => void;
}

const ServicesSection = ({ onServicePress }: ServicesSectionProps) => {
  const services = [
    { icon: 'heart-outline' as const, title: 'Favoris', color: '#FF4444', count: 12 },
    { icon: 'cube-outline' as const, title: 'Commandes', color: '#4CAF50', count: 5 },
    { icon: 'chatbubble-outline' as const, title: 'Messages', color: '#2196F3', count: 3 },
    { icon: 'card-outline' as const, title: 'Paiement', color: '#FF9800', count: null },
    { icon: 'ticket-outline' as const, title: 'Coupons', color: '#9C27B0', count: 2 },
    { icon: 'location-outline' as const, title: 'Adresses', color: '#795548', count: null },
    { icon: 'shield-checkmark-outline' as const, title: 'Garantie', color: '#607D8B', count: null },
    { icon: 'headset-outline' as const, title: 'Support', color: '#00BCD4', count: null },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Mes Services</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.servicesGrid}>
          {services.map((service, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.serviceCard}
              onPress={() => onServicePress(service.title)}
            >
              <View style={styles.iconContainer}>
                <Ionicons name={service.icon} size={24} color="#FF6B00" />
                {service.count !== null && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{service.count}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.serviceTitle}>{service.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  servicesGrid: {
    flexDirection: 'row',
  },
  serviceCard: {
    alignItems: 'center',
    marginHorizontal: 8,
    padding: 12,
    backgroundColor: '#FFF',
    borderRadius: 12,
    minWidth: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF6B00',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  serviceTitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});

export default ServicesSection;