import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function AddressesScreen() {
  const router = useRouter();
  const [addresses, setAddresses] = useState([
    {
      id: '1',
      name: 'Domicile',
      fullName: 'Mohamed Ali',
      phone: '+212 6 12 34 56 78',
      address: '123 Avenue Hassan II',
      city: 'Casablanca',
      postalCode: '20000',
      isDefault: true
    },
    {
      id: '2',
      name: 'Bureau',
      fullName: 'Mohamed Ali',
      phone: '+212 6 12 34 56 78',
      address: 'Tour Hassan, Bureau 504',
      city: 'Casablanca',
      postalCode: '20000',
      isDefault: false
    },
    {
      id: '3',
      name: 'Parents',
      fullName: 'Fatima Zahra',
      phone: '+212 6 98 76 54 32',
      address: '45 Rue Mohammed V',
      city: 'Rabat',
      postalCode: '10000',
      isDefault: false
    },
  ]);

  const setDefaultAddress = (id: string) => {
    setAddresses(addresses.map(addr => ({
      ...addr,
      isDefault: addr.id === id
    })));
  };

  const deleteAddress = (id: string) => {
    Alert.alert(
      'Supprimer l\'adresse',
      'ÃƒÅ tes-vous sÃƒÂ»r de vouloir supprimer cette adresse ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => setAddresses(addresses.filter(addr => addr.id !== id))
        },
      ]
    );
  };

  const addNewAddress = () => {
    router.push('/addresses/new');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes Adresses</Text>
        <TouchableOpacity onPress={addNewAddress}>
          <Ionicons name="add" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>
          {addresses.length} adresse{addresses.length > 1 ? 's' : ''} enregistrÃƒÂ©e{addresses.length > 1 ? 's' : ''}
        </Text>

        {addresses.map((address) => (
          <View key={address.id} style={styles.addressCard}>
            <View style={styles.addressHeader}>
              <View style={styles.addressNameContainer}>
                <Text style={styles.addressName}>{address.name}</Text>
                {address.isDefault && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultText}>DÃƒÂ©faut</Text>
                  </View>
                )}
              </View>
              <View style={styles.addressActions}>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => {/* Edit address */}}
                >
                  <Ionicons name="create-outline" size={18} color="#666" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => deleteAddress(address.id)}
                >
                  <Ionicons name="trash-outline" size={18} color="#FF4444" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.addressDetails}>
              <Text style={styles.fullName}>{address.fullName}</Text>
              <Text style={styles.phone}>{address.phone}</Text>
              <Text style={styles.addressLine}>{address.address}</Text>
              <Text style={styles.city}>
                {address.postalCode} {address.city}
              </Text>
            </View>

            {!address.isDefault && (
              <TouchableOpacity 
                style={styles.setDefaultButton}
                onPress={() => setDefaultAddress(address.id)}
              >
                <Text style={styles.setDefaultText}>DÃƒÂ©finir comme adresse par dÃƒÂ©faut</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        <TouchableOpacity style={styles.addCard} onPress={addNewAddress}>
          <Ionicons name="add-circle-outline" size={32} color="#FF6B00" />
          <Text style={styles.addCardText}>Ajouter une nouvelle adresse</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  addressCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  addressNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 8,
  },
  defaultBadge: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  defaultText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: '600',
  },
  addressActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 4,
    marginLeft: 8,
  },
  addressDetails: {
    marginBottom: 12,
  },
  fullName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  phone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  addressLine: {
    fontSize: 14,
    color: '#333',
    marginBottom: 2,
    lineHeight: 20,
  },
  city: {
    fontSize: 14,
    color: '#333',
  },
  setDefaultButton: {
    paddingVertical: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  setDefaultText: {
    fontSize: 14,
    color: '#FF6B00',
    fontWeight: '600',
  },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#F0F0F0',
    borderStyle: 'dashed',
    marginTop: 8,
  },
  addCardText: {
    fontSize: 16,
    color: '#FF6B00',
    fontWeight: '600',
    marginLeft: 8,
  },
});
