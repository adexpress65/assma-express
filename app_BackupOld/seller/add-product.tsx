import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TextInput, TouchableOpacity, Alert, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function AddProductScreen() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    originalPrice: '',
    category: '',
    stock: '',
    sku: '',
    weight: '',
    dimensions: '',
    isActive: true,
    hasVariants: false
  });

  const categories = [
    'Ã‰lectronique',
    'Mode & Accessoires',
    'Maison & Jardin',
    'BeautÃ© & SantÃ©',
    'Sports & Loisirs',
    'Automobile',
    'BÃ©bÃ© & Enfant',
    'Superette'
  ];

  const handleSubmit = () => {
    // Validation
    if (!form.title || !form.price || !form.category) {
      Alert.alert('Erreur', 'Veuillez remplir les champs obligatoires (Titre, Prix, CatÃ©gorie)');
      return;
    }

    // Simulation d'envoi
    Alert.alert(
      'Produit crÃ©Ã© !',
      'Votre produit a Ã©tÃ© crÃ©Ã© avec succÃ¨s et est en attente de validation.',
      [
        {
          text: 'Voir le produit',
          onPress: () => router.back()
        },
        {
          text: 'CrÃ©er un autre',
          style: 'cancel',
          onPress: () => setForm({
            title: '',
            description: '',
            price: '',
            originalPrice: '',
            category: '',
            stock: '',
            sku: '',
            weight: '',
            dimensions: '',
            isActive: true,
            hasVariants: false
          })
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ajouter un Produit</Text>
        <TouchableOpacity onPress={handleSubmit}>
          <Text style={styles.publishButton}>Publier</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Photos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos du produit</Text>
          <View style={styles.uploadArea}>
            <Ionicons name="camera-outline" size={48} color="#CCC" />
            <Text style={styles.uploadText}>Ajouter des photos</Text>
            <Text style={styles.uploadHint}>8 photos maximum â€¢ JPG, PNG</Text>
          </View>
          <View style={styles.photoGrid}>
            {[1, 2, 3, 4].map((item) => (
              <View key={item} style={styles.photoSlot}>
                <Ionicons name="add" size={24} color="#999" />
              </View>
            ))}
          </View>
        </View>

        {/* Informations de base */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations de base</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Titre du produit <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Smartphone Android 5G 128GB Dual SIM"
              value={form.title}
              onChangeText={(text) => setForm({...form, title: text})}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="DÃ©crivez votre produit en dÃ©tail..."
              multiline
              numberOfLines={4}
              value={form.description}
              onChangeText={(text) => setForm({...form, description: text})}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>
                Prix (DH) <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="899"
                keyboardType="numeric"
                value={form.price}
                onChangeText={(text) => setForm({...form, price: text})}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Prix original</Text>
              <TextInput
                style={styles.input}
                placeholder="1199"
                keyboardType="numeric"
                value={form.originalPrice}
                onChangeText={(text) => setForm({...form, originalPrice: text})}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              CatÃ©gorie <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity style={styles.picker}>
              <Text style={form.category ? styles.pickerTextSelected : styles.pickerText}>
                {form.category || 'SÃ©lectionner une catÃ©gorie'}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#999" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stock et inventaire */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stock et inventaire</Text>
          
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>QuantitÃ© en stock</Text>
              <TextInput
                style={styles.input}
                placeholder="50"
                keyboardType="numeric"
                value={form.stock}
                onChangeText={(text) => setForm({...form, stock: text})}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>SKU</Text>
              <TextInput
                style={styles.input}
                placeholder="SMART-5G-128"
                value={form.sku}
                onChangeText={(text) => setForm({...form, sku: text})}
              />
            </View>
          </View>

          <View style={styles.switchGroup}>
            <View>
              <Text style={styles.switchLabel}>Produit actif</Text>
              <Text style={styles.switchDescription}>Le produit sera visible dans votre boutique</Text>
            </View>
            <Switch
              value={form.isActive}
              onValueChange={(value) => setForm({...form, isActive: value})}
              trackColor={{ false: '#E0E0E0', true: '#FF6B00' }}
            />
          </View>

          <View style={styles.switchGroup}>
            <View>
              <Text style={styles.switchLabel}>Variantes</Text>
              <Text style={styles.switchDescription}>Couleurs, tailles, etc.</Text>
            </View>
            <Switch
              value={form.hasVariants}
              onValueChange={(value) => setForm({...form, hasVariants: value})}
              trackColor={{ false: '#E0E0E0', true: '#FF6B00' }}
            />
          </View>
        </View>

        {/* Livraison */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Livraison</Text>
          
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Poids (kg)</Text>
              <TextInput
                style={styles.input}
                placeholder="0.5"
                keyboardType="numeric"
                value={form.weight}
                onChangeText={(text) => setForm({...form, weight: text})}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Dimensions (cm)</Text>
              <TextInput
                style={styles.input}
                placeholder="15x8x1"
                value={form.dimensions}
                onChangeText={(text) => setForm({...form, dimensions: text})}
              />
            </View>
          </View>
        </View>

        {/* Bouton de publication */}
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Publier le produit</Text>
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
  publishButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B00',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  uploadArea: {
    height: 120,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    marginBottom: 12,
  },
  uploadText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  uploadHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoSlot: {
    width: 80,
    height: 80,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#FF4444',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFF',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFF',
  },
  pickerText: {
    fontSize: 16,
    color: '#999',
  },
  pickerTextSelected: {
    fontSize: 16,
    color: '#333',
  },
  switchGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  switchDescription: {
    fontSize: 12,
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#FF6B00',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

