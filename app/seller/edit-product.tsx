// apps/mobile/app/seller/edit-product.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  SafeAreaView,
  Image,
  Switch
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from "@/config/firebase";

export default function EditProduct() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState<any>(null);

  // États des champs
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [description, setDescription] = useState('');
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [isSpecialOffer, setIsSpecialOffer] = useState(false);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (id) loadProduct();
  }, [id]);

  const loadProduct = async () => {
    try {
      const docRef = doc(db, 'products', id as string);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        setProduct(data);
        setName(data.name || '');
        setPrice(data.price?.toString() || '0');
        setStock(data.stockQuantity?.toString() || '0');
        setDescription(data.description || '');
        setMainImage(data.mainImage || data.imageUrl || null);
        setIsSpecialOffer(data.specialOffer || false);
        setIsActive(data.isActive !== undefined ? data.isActive : true);
      }
    } catch (error) {
      Alert.alert("Erreur", "Impossible de charger le produit.");
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      setMainImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    if (uri.startsWith('http')) return uri; // Déjà sur Firebase
    const response = await fetch(uri);
    const blob = await response.blob();
    const fileRef = ref(storage, `products/updated_${id}_${Date.now()}`);
    await uploadBytes(fileRef, blob);
    return await getDownloadURL(fileRef);
  };

  const handleSave = async () => {
    if (!name || !price) {
      Alert.alert("Attention", "Le nom et le prix sont obligatoires.");
      return;
    }

    try {
      setSaving(true);
      let finalImageUrl = mainImage;

      if (mainImage && !mainImage.startsWith('http')) {
        finalImageUrl = await uploadImage(mainImage);
      }

      const docRef = doc(db, 'products', id as string);
      await updateDoc(docRef, {
        name,
        price: Number(price),
        stockQuantity: Number(stock),
        description,
        mainImage: finalImageUrl,
        imageUrl: finalImageUrl, // On met à jour les deux par sécurité
        specialOffer: isSpecialOffer,
        isActive: isActive,
        updatedAt: new Date()
      });
      
      Alert.alert("Succès", "Produit mis à jour !", [{ text: "OK", onPress: () => router.back() }]);
    } catch (error) {
      console.error(error);
      Alert.alert("Erreur", "Échec de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#FF6B00" /></View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={26} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Modifier Article</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#FF6B00" /> : <Text style={styles.saveBtn}>Sauver</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
        {/* Section Image */}
        <View style={styles.imageSection}>
          <Image source={{ uri: mainImage || 'https://via.placeholder.com/150' }} style={styles.previewImage} />
          <TouchableOpacity style={styles.changeImgBtn} onPress={pickImage}>
            <Ionicons name="camera" size={20} color="#FFF" />
            <Text style={styles.changeImgText}>Changer la photo</Text>
          </TouchableOpacity>
        </View>

        {/* Informations de base */}
        <Text style={styles.label}>Nom commercial</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.label}>Prix (XOF)</Text>
            <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Stock</Text>
            <TextInput style={styles.input} value={stock} onChangeText={setStock} keyboardType="numeric" />
          </View>
        </View>

        <Text style={styles.label}>Description du produit</Text>
        <TextInput 
          style={[styles.input, styles.textArea]} 
          value={description} 
          onChangeText={setDescription} 
          multiline 
        />

        {/* Options supplémentaires */}
        <View style={styles.switchRow}>
          <View>
            <Text style={styles.switchLabel}>Offre Spéciale</Text>
            <Text style={styles.switchSub}>Affiche un badge promo</Text>
          </View>
          <Switch value={isSpecialOffer} onValueChange={setIsSpecialOffer} trackColor={{ true: '#FF6B00' }} />
        </View>

        <View style={styles.switchRow}>
          <View>
            <Text style={styles.switchLabel}>Produit Actif</Text>
            <Text style={styles.switchSub}>Visible par les clients</Text>
          </View>
          <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: '#4CAF50' }} />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  headerTitle: { fontSize: 17, fontWeight: 'bold' },
  saveBtn: { color: '#FF6B00', fontWeight: '800', fontSize: 16 },
  closeBtn: { padding: 5 },
  form: { padding: 20 },
  imageSection: { alignItems: 'center', marginBottom: 25 },
  previewImage: { width: 140, height: 140, borderRadius: 20, backgroundColor: '#F5F5F5' },
  changeImgBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#333', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginTop: -20, elevation: 5 },
  changeImgText: { color: '#FFF', fontSize: 12, fontWeight: 'bold', marginLeft: 6 },
  label: { fontSize: 13, fontWeight: '700', color: '#888', marginBottom: 8, marginTop: 15, textTransform: 'uppercase' },
  input: { backgroundColor: '#F8F9FA', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#EEE', fontSize: 15 },
  textArea: { height: 120, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  switchLabel: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  switchSub: { fontSize: 12, color: '#AAA' }
});