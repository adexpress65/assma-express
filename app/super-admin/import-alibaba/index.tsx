import React, { useState } from "react";
import { 
  View, Text, StyleSheet, TextInput, ScrollView, 
  TouchableOpacity, ActivityIndicator, Alert, SafeAreaView, Image, Clipboard 
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import { importAlibabaToA2Express } from "@/services/importService";
import { LinearGradient } from "expo-linear-gradient";

export default function ImportAlibabaScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // États du formulaire
  const [url, setUrl] = useState("");
  const [priceUSD, setPriceUSD] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);

  // Configuration des prix (Doit correspondre à ton importService)
  const usdToXof = 615;
  const margin = 1.25;
  const fees = 5000;
  
  // Calcul dynamique du prix de vente pour l'aperçu
  const estimatedXOF = priceUSD ? Math.round((parseFloat(priceUSD.replace(',', '.')) * usdToXof * margin) + fees) : 0;

  // Fonction "Smart Paste" : Analyse le texte copié sur Alibaba
  const handlePasteSmart = async () => {
    const text = await Clipboard.getString();
    if (!text) {
      Alert.alert("Presse-papier vide", "Copiez d'abord les détails sur le site Alibaba.");
      return;
    }

    // Extraction du prix (ex: US $ 12.50)
    const priceMatch = text.match(/(?:US\s\$\s?|\$)\s?(\d+[\.,]\d*)/);
    if (priceMatch) setPriceUSD(priceMatch[1].replace(',', '.'));

    // Extraction du titre (première ligne non vide)
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);
    if (lines.length > 0) {
      const potentialTitle = lines[0].includes('$') && lines.length > 1 ? lines[1] : lines[0];
      setTitle(potentialTitle.substring(0, 100));
    }

    // Extraction de l'URL si elle est présente dans le texte
    const urlMatch = text.match(/https?:\/\/[^\s]+/);
    if (urlMatch) setUrl(urlMatch[0]);
  };

  // Sélection de l'image (Galerie)
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  // Envoi vers Firebase via le service
  const handleImport = async () => {
    if (!url || !priceUSD || !title || !image) {
      Alert.alert("Données manquantes", "Veuillez remplir le titre, le prix, le lien et choisir une image.");
      return;
    }

    setLoading(true);
    try {
      const data = {
        title: title,
        price: parseFloat(priceUSD.replace(',', '.')),
        description: description,
        images: [image],
        originalLink: url,
      };

      const result = await importAlibabaToA2Express(data);
      
      if (result.success) {
        Alert.alert("Succès ✨", "Produit publié sur A2Express !", [
          { text: "Nouveau", onPress: () => {
              setTitle(""); setPriceUSD(""); setUrl(""); setImage(null); setDescription("");
          }},
          { text: "Quitter", onPress: () => router.back() }
        ]);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Erreur", "Impossible d'importer le produit. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ 
        title: "Importateur Alibaba",
        headerRight: () => (
          <TouchableOpacity onPress={handlePasteSmart}>
            <MaterialCommunityIcons name="content-paste" size={24} color="#FF8C00" />
          </TouchableOpacity>
        )
      }} />
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* SECTION IMAGE */}
        <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
          {image ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: image }} style={styles.previewImage} />
              <View style={styles.changeBadge}>
                <Ionicons name="camera" size={20} color="#FFF" />
              </View>
            </View>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="cloud-upload-outline" size={50} color="#FF8C00" />
              <Text style={styles.placeholderText}>Cliquer pour ajouter l'image</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* FORMULAIRE */}
        <View style={styles.formContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>Fiche Produit</Text>
            <TouchableOpacity onPress={handlePasteSmart} style={styles.magicButton}>
              <Ionicons name="flash" size={14} color="#FFF" />
              <Text style={styles.magicButtonText}>Auto-remplir</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.label}>Lien du produit</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Collez le lien Alibaba ici"
            value={url}
            onChangeText={setUrl}
          />

          <Text style={styles.label}>Titre de l'article</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Nom tel qu'il apparaîtra sur l'app"
            value={title}
            onChangeText={setTitle}
            multiline
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>Prix Achat ($)</Text>
              <View style={styles.priceInputContainer}>
                <Text style={styles.currencyPrefix}>$</Text>
                <TextInput 
                  style={styles.priceInput} 
                  keyboardType="numeric"
                  value={priceUSD}
                  onChangeText={setPriceUSD}
                  placeholder="0.00"
                />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Prix Vente (XOF)</Text>
              <View style={[styles.priceInputContainer, styles.disabledInput]}>
                <Text style={styles.estimatedPrice}>{estimatedXOF.toLocaleString()} F</Text>
              </View>
            </View>
          </View>

          <Text style={styles.label}>Description (Optionnel)</Text>
          <TextInput 
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]} 
            placeholder="Détails supplémentaires..."
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </View>

        {/* BOUTON DE PUBLICATION */}
        <TouchableOpacity 
          style={[styles.importButton, loading && { opacity: 0.7 }]} 
          onPress={handleImport}
          disabled={loading}
        >
          <LinearGradient colors={['#FF8C00', '#FF4500']} style={styles.gradient}>
            {loading ? <ActivityIndicator color="#FFF" /> : (
              <View style={styles.buttonContent}>
                <Text style={styles.buttonText}>PUBLIER LE PRODUIT</Text>
                <Ionicons name="checkmark-circle" size={22} color="#FFF" style={{ marginLeft: 10 }} />
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F7F9" },
  scrollContent: { padding: 38 },
  imagePicker: {
    height: 250, backgroundColor: "#FFF", borderRadius: 20, marginBottom: 20,
    borderWidth: 2, borderColor: "#E0E0E0", borderStyle: 'dashed', overflow: 'hidden'
  },
  imagePlaceholder: { flex: 1, justifyContent: "center", alignItems: "center" },
  placeholderText: { marginTop: 10, fontSize: 14, color: "#666", fontWeight: "600" },
  imageContainer: { flex: 1 },
  previewImage: { width: "100%", height: "100%" },
  changeBadge: { position: 'absolute', bottom: 15, right: 15, backgroundColor: '#FF8C00', padding: 10, borderRadius: 25 },
  formContainer: { backgroundColor: "#FFF", borderRadius: 20, padding: 30, elevation: 6 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#1A1A1A" },
  magicButton: { flexDirection: 'row', backgroundColor: '#6C63FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, alignItems: 'center' },
  magicButtonText: { color: '#FFF', fontSize: 12, fontWeight: 'bold', marginLeft: 5 },
  label: { fontSize: 13, fontWeight: "600", color: "#666", marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: "#F8F9FA", borderRadius: 12, padding: 14, fontSize: 15, borderWidth: 1, borderColor: "#EEE" },
  row: { flexDirection: "row", marginTop: 5 },
  priceInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: "#F8F9FA", borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: "#EEE" },
  currencyPrefix: { fontSize: 16, fontWeight: "bold", color: "#333", marginRight: 5 },
  priceInput: { flex: 1, paddingVertical: 14, fontSize: 16, fontWeight: "bold" },
  disabledInput: { backgroundColor: "#E9ECEF", borderColor: "#DDD" },
  estimatedPrice: { fontSize: 16, fontWeight: "bold", color: "#FF4500", paddingVertical: 14 },
  importButton: { marginTop: 25, borderRadius: 15, overflow: "hidden", elevation: 5 },
  gradient: { padding: 18 },
  buttonContent: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: "#FFF", fontSize: 16, fontWeight: "900", letterSpacing: 1 }
});