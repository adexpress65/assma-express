// apps/mobile/app/super-admin/add-product.tsx - VERSION FINALE CORRECTE
import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, SafeAreaView, ScrollView, 
  TextInput, TouchableOpacity, Alert, Switch, Image,
  ActivityIndicator, Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { collection, addDoc, getDocs, updateDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/contexts/AuthContext';
import { db, storage } from '../../src/config/firebase';

// ? FONCTION POUR GÉNÉRER UN SLUG
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100);
};

// ✅ FONCTION UPLOAD CORRECTE - DEBUG BRUT
const uploadImageToFirebase = async (imageUri: string, path: string): Promise<string> => {
  console.log('🔥 FONCTION UPLOAD APPELÉE');
  console.log('🔥 URI:', imageUri);
  console.log('🔥 PATH:', path);
  
  try {
    // VÉRIFICATION USER
    console.log('🔥 Vérification user...');
    
    // CONVERSION URI → BLOB
    console.log('🔥 Conversion URI → Blob...');
    const response = await fetch(imageUri);
    
    if (!response.ok) {
      console.log('🔥 FETCH FAILED:', response.status, response.statusText);
      throw new Error(`Fetch failed: ${response.status}`);
    }
    
    const blob = await response.blob();
    console.log('🔥 BLOB créé:', blob.size, 'bytes, type:', blob.type);
    
    if (blob.size === 0) {
      throw new Error('Blob vide (0 bytes)');
    }
    
    // UPLOAD FIREBASE
    console.log('🔥 Création référence Firebase Storage...');
    const storageRef = ref(storage, path);
    
    console.log('🔥 UploadBytes appelé...');
    await uploadBytes(storageRef, blob);
    
    console.log('🔥 getDownloadURL appelé...');
    const downloadURL = await getDownloadURL(storageRef);
    
    console.log('🔥 ✅ UPLOAD RÉUSSI');
    console.log('🔥 URL:', downloadURL.substring(0, 80));
    
    return downloadURL;

  } catch (error: any) {
    // ✅ DEBUG BRUT - PAS DE MESSAGE CUSTOM
    console.log('🔥🔥🔥 FIREBASE STORAGE ERROR BRUT 🔥🔥🔥');
    console.log('🔥 CODE:', error?.code);
    console.log('🔥 MESSAGE:', error?.message);
    console.log('🔥 SERVER RESPONSE:', error?.serverResponse);
    console.log('🔥 CUSTOM DATA:', error?.customData);
    console.log('🔥 ERROR OBJECT:', JSON.stringify(error, null, 2));
    console.log('🔥 STACK:', error?.stack);
    
    // NE PAS CRÉER DE NOUVELLE ERREUR - PROPAGER L'ERREUR ORIGINALE
    throw error;
  }
};

// ✅ FONCTION UPLOAD MULTIPLE AVEC DEBUG
const uploadImagesToFirebase = async (imageUris: string[], userId: string): Promise<string[]> => {
  console.log('🔥🔥🔥 UPLOAD IMAGES MULTIPLE DÉBUT 🔥🔥🔥');
  console.log('🔥 Nombre d\'images:', imageUris.length);
  console.log('🔥 User ID:', userId);
  console.log('🔥 Storage Bucket:', storage?.app?.options?.storageBucket);
  
  // ✅ VÉRIFICATION CRITIQUE - USER
  if (!userId || userId === 'anonymous') {
    const error = new Error('USER NOT READY - userId invalide');
    console.log('🔥 ERREUR USER:', error.message);
    throw error;
  }
  
  // ✅ VÉRIFICATION CRITIQUE - STORAGE
  if (!storage) {
    const error = new Error('STORAGE NON INITIALISÉ');
    console.log('🔥 ERREUR STORAGE:', error.message);
    throw error;
  }
  
  const uploadedUrls: string[] = [];
  
  for (let i = 0; i < imageUris.length; i++) {
    const imageUri = imageUris[i];
    console.log(`🔥 Traitement image ${i + 1}/${imageUris.length}`);
    
    try {
      // CHEMIN SIMPLE
      const timestamp = Date.now();
      const fileName = `products/${userId}/${timestamp}_${i + 1}.jpg`;
      
      console.log(`🔥 Upload image ${i + 1} vers: ${fileName}`);
      
      const downloadURL = await uploadImageToFirebase(imageUri, fileName);
      uploadedUrls.push(downloadURL);
      
      console.log(`🔥 ✅ Image ${i + 1} uploadée`);

    } catch (error: any) {
      console.log(`🔥🔥🔥 ERREUR IMAGE ${i + 1} 🔥🔥🔥`);
      console.log('🔥 Code:', error?.code);
      console.log('🔥 Message:', error?.message);
      
      // Si c'est la première image, propager l'erreur
      if (i === 0) {
        console.log('🔥 Échec image principale - propagation erreur');
        throw error; // ✅ PROPAGATION DIRECTE, PAS DE NEW ERROR
      }
      
      // Pour les images secondaires, log mais continuer
      console.log(`🔥 ⚠️ Image ${i + 1} ignorée (secondaire)`);
    }
  }
  
  if (uploadedUrls.length === 0) {
    const error = new Error('AUCUNE IMAGE UPLOADÉE');
    console.log('🔥 Échec complet:', error.message);
    throw error;
  }
  
  console.log(`🔥 ✅ Upload terminé: ${uploadedUrls.length}/${imageUris.length} images`);
  return uploadedUrls;
};

export default function AddProductScreen() {
  const router = useRouter();
  const { user, userRole } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  
  // ✅ DEBUG STORAGE BUCKET
  useEffect(() => {
    console.log('🧪 DEBUG STORAGE BUCKET');
    console.log('🧪 Storage object exists:', !!storage);
    if (storage) {
      console.log('🧪 Storage app exists:', !!storage.app);
      console.log('🧪 Storage options:', storage.app?.options);
      console.log('🧪 Storage Bucket:', storage.app?.options?.storageBucket);
    }
  }, []);

  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    originalPrice: '',
    category: '',
    stock: '10',
    sku: '',
    weight: '',
    dimensions: '',
    isActive: true,
    hasVariants: false,
    supplier: '',
    deliveryTime: '3-5 jours',
    minOrder: '1',
    
    // Sections d'affichage
    featured: false,
    trending: false,
    specialOffer: false,
    newArrival: true,
    industrial: false,
    premiumSupplier: false,
  });

  const categories = [
    'Électronique',
    'Mode & Accessoires',
    'Maison & Jardin',
    'Beauté & Santé',
    'Sports & Loisirs',
    'Automobile',
    'Bébé & Enfant',
    'Superette',
    'Machines Industrielles',
    'Équipements Professionnels'
  ];

  // FONCTION PICKIMAGE
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission requise',
          'Pour sélectionner des images, veuillez autoriser l\'accès à votre galerie.',
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Paramètres', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: 8 - images.length
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newImages = result.assets.map(asset => asset.uri);
        setImages(prev => [...prev, ...newImages].slice(0, 8));
      }

    } catch (error: any) {
      console.log('🔥 ERREUR PICKIMAGE:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner des images');
    }
  };

  // SUPPRIMER IMAGE
  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  // ✅ FONCTION HANDLESUBMIT AVEC DEBUG
  const handleSubmit = async () => {
    console.log('🔥🔥🔥 HANDLE SUBMIT DÉBUT 🔥🔥🔥');
    
    // VALIDATIONS
    if (!form.title.trim()) {
      Alert.alert('Erreur', 'Le titre du produit est requis');
      return;
    }

    if (!form.price || Number(form.price) <= 0) {
      Alert.alert('Erreur', 'Le prix doit être supérieur à 0');
      return;
    }

    if (!form.category) {
      Alert.alert('Erreur', 'Veuillez sélectionner une catégorie');
      return;
    }

    if (images.length === 0) {
      Alert.alert('Images requises', 'Veuillez ajouter au moins une image du produit');
      return;
    }

    // ✅ VÉRIFICATION USER CRITIQUE
    console.log('🔥 Vérification user...');
    console.log('🔥 User object:', user);
    console.log('🔥 User UID:', user?.uid);
    
    if (!user || !user.uid) {
      console.log('🔥 ❌ ERREUR: USER NON PRÊT');
      Alert.alert('Erreur', 'Vous devez être connecté pour créer un produit');
      return;
    }

    setLoading(true);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      console.log('🔥 Début création produit pour user:', user.uid);
      
      // PROGRESSION
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => prev < 90 ? prev + 10 : 90);
      }, 200);

      // 1. UPLOAD DES IMAGES
      console.log(`🔥 Upload ${images.length} image(s)...`);
      const uploadedImageUrls = await uploadImagesToFirebase(images, user.uid);
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      // 2. CRÉATION PRODUIT FIRESTORE
      console.log('🔥 Création produit Firestore...');
      
      const productData = {
        id: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'published',
        name: form.title.trim(),
        description: form.description.trim() || `Découvrez notre produit ${form.title.trim()}`,
        price: Number(form.price),
        originalPrice: form.originalPrice ? Number(form.originalPrice) : null,
        currency: 'XOF',
        images: uploadedImageUrls,
        mainImage: uploadedImageUrls[0],
        imageUrl: uploadedImageUrls[0],
        categoryId: await getCategoryId(form.category),
        categoryName: form.category,
        companyId: user.uid,
        companyName: form.supplier.trim() || user.displayName || 'Mon Entreprise',
        supplier: form.supplier.trim() || user.displayName || 'Vendeur',
        specifications: {
          modelNumber: form.sku.trim() || `MODEL-${Date.now()}`,
          weight: form.weight.trim() || '',
          dimensions: form.dimensions.trim() || '',
        },
        stockQuantity: Number(form.stock) || 10,
        minOrder: Number(form.minOrder) || 1,
        inStock: form.isActive,
        shippingCost: 0,
        deliveryTime: form.deliveryTime,
        rating: 0,
        reviewCount: 0,
        soldCount: 0,
        createdBy: userRole === 'admin' ? 'admin' : 'company',
        creatorId: user.uid,
        isVerified: userRole === 'admin',
        featured: form.featured,
        trending: form.trending,
        specialOffer: form.specialOffer,
        newArrival: form.newArrival,
        industrial: form.industrial,
        premiumSupplier: form.premiumSupplier,
        slug: generateSlug(form.title.trim()),
        isActive: form.isActive,
      };

      const docRef = await addDoc(collection(db, 'products'), productData);
      await updateDoc(docRef, { id: docRef.id });

      console.log('🔥 ✅ PRODUIT CRÉÉ ID:', docRef.id);

      Alert.alert(
        'Succès! 🎉',
        `"${form.title}" a été créé avec succès.`,
        [
          {
            text: 'Voir le produit',
            onPress: () => router.push(`/product/${docRef.id}`)
          },
          {
            text: 'Créer un autre',
            style: 'cancel',
            onPress: () => resetForm()
          }
        ]
      );

    } catch (error: any) {
      // ✅ DEBUG BRUT - PAS DE MESSAGE CUSTOM
      console.log('🔥🔥🔥 ERREUR HANDLE SUBMIT 🔥🔥🔥');
      console.log('🔥 Type:', typeof error);
      console.log('🔥 Code:', error?.code);
      console.log('🔥 Message:', error?.message);
      console.log('🔥 Full error:', JSON.stringify(error, null, 2));
      
      // Afficher l'erreur Firebase BRUTE
      Alert.alert(
        'Erreur Firebase',
        `Code: ${error?.code || 'N/A'}\nMessage: ${error?.message || 'Erreur inconnue'}`,
        [{ text: 'OK' }]
      );
      
    } finally {
      setLoading(false);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // FONCTION CATÉGORIE
  const getCategoryId = async (categoryName: string): Promise<string> => {
    try {
      const categoriesQuery = await getDocs(collection(db, 'categories'));
      const existingCategory = categoriesQuery.docs.find(doc => 
        doc.data().name === categoryName
      );

      if (existingCategory) {
        return existingCategory.id;
      }

      const newCategoryRef = await addDoc(collection(db, 'categories'), {
        name: categoryName,
        description: `Catégorie ${categoryName}`,
        imageUrl: null,
        isActive: true,
        productCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      return newCategoryRef.id;
      
    } catch (error) {
      console.error('Erreur catégorie:', error);
      return 'default-category';
    }
  };

  // RÉINITIALISER FORMULAIRE
  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      price: '',
      originalPrice: '',
      category: '',
      stock: '10',
      sku: '',
      weight: '',
      dimensions: '',
      isActive: true,
      hasVariants: false,
      supplier: '',
      deliveryTime: '3-5 jours',
      minOrder: '1',
      featured: false,
      trending: false,
      specialOffer: false,
      newArrival: true,
      industrial: false,
      premiumSupplier: false,
    });
    setImages([]);
    setShowCategoryDropdown(false);
  };

  // COMPOSANT TOGGLE
  const SectionToggle = ({ label, value, onValueChange, description }) => (
    <View style={styles.toggleContainer}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#767577', true: '#81b0ff' }}
        thumbColor={value ? '#ff6a00' : '#f4f3f4'}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nouveau Produit</Text>
        <TouchableOpacity onPress={handleSubmit} disabled={loading}>
          <Text style={[styles.publishButton, loading && styles.publishButtonDisabled]}>
            {loading ? '...' : 'Créer'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Overlay de chargement */}
      {(loading || isUploading) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={styles.loadingText}>
            {isUploading 
              ? `Upload des images... ${uploadProgress}%` 
              : 'Création du produit...'
            }
          </Text>
          <Text style={styles.loadingSubtext}>
            {isUploading ? 'Ne pas fermer l\'application' : 'Traitement en cours...'}
          </Text>
          
          {isUploading && (
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${uploadProgress}%` }
                ]} 
              />
            </View>
          )}
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Section Photos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📸 Photos du produit</Text>
            <Text style={styles.requiredLabel}>(Obligatoire)</Text>
          </View>
          
          <Text style={styles.sectionSubtitle}>
            {images.length > 0 
              ? `${images.length} image(s) sélectionnée(s)`
              : 'Ajoutez au moins une image de qualité'
            }
          </Text>
          
          <TouchableOpacity style={styles.uploadArea} onPress={pickImage}>
            <Ionicons name="camera-outline" size={48} color="#CCC" />
            <Text style={styles.uploadText}>
              {images.length > 0 ? 'Ajouter plus de photos' : '+ Ajouter des photos'}
            </Text>
            <Text style={styles.uploadHint}>8 maximum • JPEG, PNG</Text>
          </TouchableOpacity>

          {/* Aperçu des images */}
          {images.length > 0 && (
            <View style={styles.photoGrid}>
              {images.map((image, index) => (
                <View key={index} style={styles.photoItem}>
                  <Image source={{ uri: image }} style={styles.photoImage} />
                  {index === 0 && (
                    <View style={styles.mainImageBadge}>
                      <Text style={styles.mainImageText}>Principale</Text>
                    </View>
                  )}
                  <TouchableOpacity 
                    style={styles.removePhotoButton}
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close-circle" size={20} color="#FF4444" />
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < 8 && (
                <TouchableOpacity style={styles.photoSlot} onPress={pickImage}>
                  <Ionicons name="add" size={24} color="#999" />
                  <Text style={styles.photoSlotText}>Ajouter</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Informations de base */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Informations de base</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Titre du produit <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Smartphone Android 5G 128GB"
              value={form.title}
              onChangeText={(text) => setForm({...form, title: text})}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Décrivez votre produit..."
              multiline
              numberOfLines={4}
              value={form.description}
              onChangeText={(text) => setForm({...form, description: text})}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>
                Prix (F CFA) <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="18900"
                keyboardType="numeric"
                value={form.price}
                onChangeText={(text) => setForm({...form, price: text})}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Prix original</Text>
              <TextInput
                style={styles.input}
                placeholder="22000"
                keyboardType="numeric"
                value={form.originalPrice}
                onChangeText={(text) => setForm({...form, originalPrice: text})}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Catégorie <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity 
              style={styles.picker}
              onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
            >
              <Text style={form.category ? styles.pickerTextSelected : styles.pickerText}>
                {form.category || 'Sélectionner une catégorie'}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#999" />
            </TouchableOpacity>

            {showCategoryDropdown && (
              <View style={styles.dropdown}>
                <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                  {categories.map((cat, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setForm({...form, category: cat});
                        setShowCategoryDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownText}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Fournisseur</Text>
            <TextInput
              style={styles.input}
              placeholder="Nom du fournisseur"
              value={form.supplier}
              onChangeText={(text) => setForm({...form, supplier: text})}
            />
          </View>
        </View>

        {/* Sections d'affichage */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 Sections d'affichage</Text>
          <Text style={styles.sectionSubtitle}>
            Choisissez où votre produit apparaîtra sur la page d'accueil
          </Text>

          <SectionToggle
            label="⭐ Vedette sur l'accueil"
            value={form.featured}
            onValueChange={(value) => setForm({...form, featured: value})}
            description="Produit mis en avant en haut de page"
          />

          <SectionToggle
            label="📈 Tendances"
            value={form.trending}
            onValueChange={(value) => setForm({...form, trending: value})}
            description="Section populaire du moment"
          />

          <SectionToggle
            label="🔥 Offres spéciales"
            value={form.specialOffer}
            onValueChange={(value) => setForm({...form, specialOffer: value})}
            description="Pour les promotions et soldes"
          />

          <SectionToggle
            label="🆕 Nouveautés"
            value={form.newArrival}
            onValueChange={(value) => setForm({...form, newArrival: value})}
            description="Tous les nouveaux produits (recommandé)"
          />

          <SectionToggle
            label="🏭 Machines industrielles"
            value={form.industrial}
            onValueChange={(value) => setForm({...form, industrial: value})}
            description="Section équipements professionnels"
          />

          <SectionToggle
            label="👑 Fournisseurs premium"
            value={form.premiumSupplier}
            onValueChange={(value) => setForm({...form, premiumSupplier: value})}
            description="Pour vendeurs certifiés"
          />
        </View>

        {/* Stock et inventaire */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📦 Stock et inventaire</Text>
          
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Quantité en stock</Text>
              <TextInput
                style={styles.input}
                placeholder="50"
                keyboardType="numeric"
                value={form.stock}
                onChangeText={(text) => setForm({...form, stock: text})}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Commande minimum</Text>
              <TextInput
                style={styles.input}
                placeholder="1"
                keyboardType="numeric"
                value={form.minOrder}
                onChangeText={(text) => setForm({...form, minOrder: text})}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Délai de livraison</Text>
            <TextInput
              style={styles.input}
              placeholder="3-5 jours"
              value={form.deliveryTime}
              onChangeText={(text) => setForm({...form, deliveryTime: text})}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Référence SKU</Text>
            <TextInput
              style={styles.input}
              placeholder="SMART-5G-128"
              value={form.sku}
              onChangeText={(text) => setForm({...form, sku: text})}
            />
          </View>

          <View style={styles.switchGroup}>
            <View>
              <Text style={styles.switchLabel}>Produit actif</Text>
              <Text style={styles.switchDescription}>Visible dans la boutique</Text>
            </View>
            <Switch
              value={form.isActive}
              onValueChange={(value) => setForm({...form, isActive: value})}
              trackColor={{ false: '#E0E0E0', true: '#FF6B00' }}
            />
          </View>
        </View>

        {/* Livraison */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🚚 Informations livraison</Text>
          
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

        {/* Bouton de création */}
        <TouchableOpacity 
          style={[styles.submitButton, (loading || isUploading) && styles.submitButtonDisabled]} 
          onPress={handleSubmit}
          disabled={loading || isUploading}
        >
          {(loading || isUploading) ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={20} color="#FFF" />
              <Text style={styles.submitButtonText}>Créer le produit</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ? STYLES COMPLETS
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FFF' 
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
    color: '#333' 
  },
  publishButton: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#FF6B00' 
  },
  publishButtonDisabled: { 
    opacity: 0.5 
  },
  content: { 
    flex: 1 
  },
  section: { 
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F0F0F0' 
  },
  sectionHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 8 
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#333', 
    marginRight: 8 
  },
  sectionSubtitle: { 
    fontSize: 14, 
    color: '#666', 
    marginBottom: 16 
  },
  requiredLabel: { 
    fontSize: 12, 
    color: '#FF4444', 
    fontWeight: '600' 
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
    marginBottom: 16,
  },
  uploadText: { 
    fontSize: 16, 
    color: '#666', 
    marginTop: 8, 
    fontWeight: '500' 
  },
  uploadHint: { 
    fontSize: 12, 
    color: '#999', 
    marginTop: 4 
  },
  photoGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 12 
  },
  photoItem: { 
    width: 100, 
    height: 100, 
    borderRadius: 8, 
    position: 'relative' 
  },
  photoImage: { 
    width: '100%', 
    height: '100%', 
    borderRadius: 8 
  },
  mainImageBadge: {
    position: 'absolute', 
    top: 4, 
    left: 4, 
    backgroundColor: '#FF6B00',
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 4,
  },
  mainImageText: { 
    color: '#FFF', 
    fontSize: 10, 
    fontWeight: 'bold' 
  },
  removePhotoButton: {
    position: 'absolute', 
    top: -6, 
    right: -6, 
    backgroundColor: '#FFF',
    borderRadius: 10, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2, 
    shadowRadius: 2, 
    elevation: 2,
  },
  photoSlot: {
    width: 100, 
    height: 100, 
    backgroundColor: '#F8F9FA', 
    borderRadius: 8,
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#E0E0E0',
  },
  photoSlotText: { 
    fontSize: 12, 
    color: '#999', 
    marginTop: 4 
  },
  inputGroup: { 
    marginBottom: 16, 
    position: 'relative' 
  },
  label: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#333', 
    marginBottom: 8 
  },
  required: { 
    color: '#FF4444' 
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
    textAlignVertical: 'top' 
  },
  row: { 
    flexDirection: 'row' 
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
    color: '#999' 
  },
  pickerTextSelected: { 
    fontSize: 16, 
    color: '#333' 
  },
  dropdown: {
    position: 'absolute', 
    top: 70, 
    left: 0, 
    right: 0, 
    backgroundColor: '#FFF',
    borderWidth: 1, 
    borderColor: '#E0E0E0', 
    borderRadius: 8, 
    zIndex: 1000,
    elevation: 5, 
    maxHeight: 200,
  },
  dropdownScroll: { 
    maxHeight: 200 
  },
  dropdownItem: { 
    padding: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F0F0F0' 
  },
  dropdownText: { 
    fontSize: 16, 
    color: '#333' 
  },
  toggleContainer: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0',
  },
  toggleText: { 
    flex: 1, 
    marginRight: 12 
  },
  toggleLabel: { 
    fontSize: 16, 
    fontWeight: '500', 
    color: '#1A1A1A', 
    marginBottom: 4 
  },
  toggleDescription: { 
    fontSize: 12, 
    color: '#6c757d' 
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
    marginBottom: 2 
  },
  switchDescription: { 
    fontSize: 12, 
    color: '#666' 
  },
  submitButton: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: '#FF6B00', 
    margin: 16, 
    padding: 16, 
    borderRadius: 8, 
    gap: 8,
  },
  submitButtonDisabled: { 
    opacity: 0.6 
  },
  submitButtonText: { 
    color: '#FFF', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  loadingOverlay: {
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
    justifyContent: 'center',
    alignItems: 'center', 
    zIndex: 1000,
  },
  loadingText: { 
    marginTop: 12, 
    fontSize: 16, 
    color: '#666', 
    fontWeight: '600' 
  },
  loadingSubtext: { 
    marginTop: 8, 
    fontSize: 14, 
    color: '#999' 
  },
  progressBar: {
    width: '80%', 
    height: 6, 
    backgroundColor: '#E0E0E0', 
    borderRadius: 3,
    marginTop: 16, 
    overflow: 'hidden',
  },
  progressFill: { 
    height: '100%', 
    backgroundColor: '#FF6B00', 
    borderRadius: 3 
  },
  spacer: { 
    height: 20 
  },
});