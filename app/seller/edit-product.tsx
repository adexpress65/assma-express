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
import { useExchangeRates } from '@/hooks/useExchangeRates';
import {
  PRODUCT_PRICE_CURRENCIES,
  buildCatalogPriceFields,
  convertToXOF,
  getCurrencyMeta,
  getRateToXOF,
  parseProductPriceCurrency,
  type ProductPriceCurrency,
} from '@/utils/productPrice';

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
  const [unlimitedStock, setUnlimitedStock] = useState(false);
  const [description, setDescription] = useState('');
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [isSpecialOffer, setIsSpecialOffer] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [priceCurrency, setPriceCurrency] = useState<ProductPriceCurrency>('XOF');
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const { rates: exchangeRates } = useExchangeRates();
  const currencyMeta = getCurrencyMeta(priceCurrency);
  const rateToXof = getRateToXOF(priceCurrency, exchangeRates);
  const enteredPrice = Number(price) || 0;
  const priceXofPreview = convertToXOF(enteredPrice, priceCurrency, exchangeRates);
  const isForeignCurrency = priceCurrency !== 'XOF';

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
        const loadedCurrency = parseProductPriceCurrency(data.priceCurrency);
        setPriceCurrency(loadedCurrency);
        const loadedSelling =
          data.priceOriginal != null && Number.isFinite(Number(data.priceOriginal))
            ? Number(data.priceOriginal)
            : Number(data.price) || 0;
        setPrice(String(loadedSelling));
        setStock(data.stockQuantity?.toString() || '0');
        setUnlimitedStock(data.unlimitedStock === true);
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

      const originalPriceInput =
        product?.originalPriceOriginal != null &&
        Number.isFinite(Number(product.originalPriceOriginal))
          ? Number(product.originalPriceOriginal)
          : priceCurrency === 'XOF' && product?.originalPrice != null
            ? Number(product.originalPrice)
            : null;

      const catalogPrices = buildCatalogPriceFields({
        basePrice: Number(price),
        finalPrice: Number(price),
        originalPriceInput,
        priceAdjustment: Number(product?.priceAdjustment) || 0,
        priceCurrency,
        rates: exchangeRates,
      });

      const variantsUpdate = Array.isArray(product?.variants)
        ? {
            variants: product.variants.map((v: { price?: number; priceOriginal?: number }) => {
              if (v.priceOriginal != null && Number.isFinite(Number(v.priceOriginal))) {
                const entered = Number(v.priceOriginal);
                return {
                  ...v,
                  price: convertToXOF(entered, priceCurrency, exchangeRates),
                  priceOriginal: entered,
                };
              }
              if (priceCurrency === 'XOF') {
                const entered = Number(v.price) || 0;
                return { ...v, price: entered, priceOriginal: entered };
              }
              return v;
            }),
          }
        : {};

      const docRef = doc(db, 'products', id as string);
      await updateDoc(docRef, {
        name,
        price: catalogPrices.price,
        basePrice: catalogPrices.basePrice,
        originalPrice: catalogPrices.originalPrice,
        currency: catalogPrices.currency,
        priceOriginal: catalogPrices.priceOriginal,
        priceCurrency: catalogPrices.priceCurrency,
        priceXOF: catalogPrices.priceXOF,
        exchangeRateUsed: catalogPrices.exchangeRateUsed,
        originalPriceOriginal: catalogPrices.originalPriceOriginal,
        ...variantsUpdate,
        stockQuantity: Number(stock),
        unlimitedStock,
        inStock: unlimitedStock || Number(stock) > 0,
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

        <Text style={styles.label}>Devise du prix</Text>
        <TouchableOpacity
          style={styles.picker}
          onPress={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
        >
          <Text style={styles.pickerText}>{currencyMeta.label}</Text>
          <Ionicons name="chevron-down" size={16} color="#999" />
        </TouchableOpacity>
        {showCurrencyDropdown && (
          <View style={styles.currencyDropdown}>
            {PRODUCT_PRICE_CURRENCIES.map((opt) => (
              <TouchableOpacity
                key={opt.code}
                style={[
                  styles.currencyOption,
                  priceCurrency === opt.code && styles.currencyOptionActive,
                ]}
                onPress={() => {
                  setPriceCurrency(opt.code);
                  setShowCurrencyDropdown(false);
                }}
              >
                <Text
                  style={[
                    styles.currencyOptionText,
                    priceCurrency === opt.code && styles.currencyOptionTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
                {priceCurrency === opt.code ? (
                  <Ionicons name="checkmark" size={16} color="#FF6B00" />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.label}>Prix normal</Text>
            <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" />
            {isForeignCurrency && price ? (
              <Text style={styles.fxPreviewText}>
                Équivaut à environ {priceXofPreview.toLocaleString()} F CFA (Taux : 1 {priceCurrency} = {rateToXof} XOF)
              </Text>
            ) : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Stock</Text>
            <TextInput
              style={[styles.input, unlimitedStock && styles.inputDisabled]}
              value={stock}
              onChangeText={setStock}
              keyboardType="numeric"
              editable={!unlimitedStock}
            />
            <TouchableOpacity
              style={styles.unlimitedRow}
              onPress={() => setUnlimitedStock((v) => !v)}
            >
              <Ionicons
                name={unlimitedStock ? 'checkbox' : 'square-outline'}
                size={22}
                color="#FF6B00"
              />
              <Text style={styles.unlimitedLabel}>Stock illimité</Text>
            </TouchableOpacity>
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
  inputDisabled: { backgroundColor: '#F3F4F6', color: '#9CA3AF' },
  unlimitedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  unlimitedLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
  textArea: { height: 120, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  pickerText: { fontSize: 15, color: '#333', fontWeight: '600' },
  currencyDropdown: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#EEE',
    borderRadius: 12,
    backgroundColor: '#FFF',
    overflow: 'hidden',
  },
  currencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  currencyOptionActive: { backgroundColor: '#FFF5EE' },
  currencyOptionText: { fontSize: 15, color: '#333' },
  currencyOptionTextActive: { color: '#FF6B00', fontWeight: '600' },
  fxPreviewText: { marginTop: 8, fontSize: 12, color: '#666', lineHeight: 17 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  switchLabel: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  switchSub: { fontSize: 12, color: '#AAA' }
});