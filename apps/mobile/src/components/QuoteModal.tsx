// app/components/QuoteModal.tsx
import React, { useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  companyName: string;
  onClose: () => void;
  onSubmit: (data: { product: string; quantity: string; deliveryDate: string }) => void;
}

export default function QuoteModal({ visible, companyName, onClose, onSubmit }: Props) {
  const [product, setProduct] = useState('');
  const [quantity, setQuantity] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');

  const handleSend = () => {
    if (!product || !quantity || !deliveryDate) {
      Alert.alert('Champs manquants', 'Veuillez remplir tous les champs.');
      return;
    }
    onSubmit({ product, quantity, deliveryDate });
    setProduct('');
    setQuantity('');
    setDeliveryDate('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Demander un devis à {companyName}</Text>

          <TextInput
            style={styles.input}
            placeholder="Produit ou service dont vous avez besoin"
            value={product}
            onChangeText={setProduct}
          />

          <TextInput
            style={styles.input}
            placeholder="Quantité (ex: 1000 unités)"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
          />

          <TextInput
            style={styles.input}
            placeholder="Date de livraison (ex: Janvier 2025)"
            value={deliveryDate}
            onChangeText={setDeliveryDate}
          />

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
              <Text style={styles.sendText}>Envoyer la demande</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  container: { backgroundColor: '#fff', padding: 24, borderRadius: 16, width: '90%' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  cancelText: { color: '#666' },
  sendBtn: { backgroundColor: '#ff6a00', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  sendText: { color: '#fff', fontWeight: '600' },
});
