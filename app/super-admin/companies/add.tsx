import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert, Image, ActivityIndicator } from 'react-native';
import { db, storage } from '@/config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function AddCompanyScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    type: 'boutique', // boutique, usine, entreprise
    description: '',
    location: '',
    isPremium: false,
    contactEmail: ''
  });

  // Fonction pour choisir une image (Logo)
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  // Fonction d'upload vers Firebase Storage
  const uploadImageAsync = async (uri: string) => {
    const blob: any = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () { resolve(xhr.response); };
      xhr.onerror = function (e) { reject(new TypeError("Network request failed")); };
      xhr.responseType = "blob";
      xhr.open("GET", uri, true);
      xhr.send(null);
    });

    const fileRef = ref(storage, `logos/${Date.now()}`);
    await uploadBytes(fileRef, blob);
    return await getDownloadURL(fileRef);
  };

  const handleSave = async () => {
    if (!form.name || !form.location) {
      return Alert.alert("Erreur", "Le nom et la localisation sont obligatoires.");
    }

    setLoading(true);
    try {
      let logoUrl = "";
      if (image) {
        logoUrl = await uploadImageAsync(image);
      }

      // Enregistrement dans Firestore
      await addDoc(collection(db, 'companies'), {
        ...form,
        logo: logoUrl,
        createdAt: serverTimestamp(),
        status: 'active',
        verified: true
      });

      Alert.alert("Succès", `${form.name} a été enregistré.`);
      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert("Erreur", "Impossible d'enregistrer l'entreprise.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Nouvelle Entreprise / Boutique</Text>

      {/* Upload Logo */}
      <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
        {image ? (
          <Image source={{ uri: image }} style={styles.logoPreview} />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="camera" size={40} color="#666" />
            <Text>Ajouter un Logo</Text>
          </View>
        )}
      </TouchableOpacity>

      <TextInput placeholder="Nom de l'entité" style={styles.input} onChangeText={(t) => setForm({...form, name: t})} />
      
      <View style={styles.typeContainer}>
        {['boutique', 'usine', 'entreprise'].map((t) => (
          <TouchableOpacity 
            key={t} 
            style={[styles.typeBtn, form.type === t && styles.typeBtnActive]}
            onPress={() => setForm({...form, type: t})}
          >
            <Text style={{color: form.type === t ? '#fff' : '#000'}}>{t.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput placeholder="Localisation (Ville, Quartier)" style={styles.input} onChangeText={(t) => setForm({...form, location: t})} />
      <TextInput placeholder="Email de contact" style={styles.input} onChangeText={(t) => setForm({...form, contactEmail: t})} />
      <TextInput placeholder="Description" multiline numberOfLines={4} style={[styles.input, {height: 100}]} onChangeText={(t) => setForm({...form, description: t})} />

      {/* Option Premium */}
      <TouchableOpacity 
        style={[styles.premiumBtn, form.isPremium && styles.premiumBtnActive]} 
        onPress={() => setForm({...form, isPremium: !form.isPremium})}
      >
        <Ionicons name="star" size={20} color={form.isPremium ? "#fff" : "#FFD700"} />
        <Text style={styles.premiumText}>{form.isPremium ? "C'est une Entreprise Premium" : "Marquer comme Premium ?"}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>ENREGISTRER L'ENTREPRISE</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f8f9fa' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#eee' },
  imagePicker: { alignSelf: 'center', marginBottom: 20 },
  logoPreview: { width: 120, height: 120, borderRadius: 60 },
  placeholder: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#e1e1e1', justifyContent: 'center', alignItems: 'center' },
  typeContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  typeBtn: { padding: 10, borderRadius: 5, backgroundColor: '#eee', width: '30%', alignItems: 'center' },
  typeBtnActive: { backgroundColor: '#FF6B00' },
  premiumBtn: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#FFD700' },
  premiumBtnActive: { backgroundColor: '#FFD700' },
  premiumText: { marginLeft: 10, fontWeight: 'bold' },
  saveBtn: { backgroundColor: '#4CAF50', padding: 20, borderRadius: 10, alignItems: 'center', marginBottom: 50 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
