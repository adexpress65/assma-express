// apps/mobile/app/seller/add-product.tsx - CODE COMPLET CORRIGÉ
import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, SafeAreaView, ScrollView, 
  TextInput, TouchableOpacity, Alert, Switch, Image,
  ActivityIndicator, Modal, FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { 
  collection, addDoc, getDocs, updateDoc, doc, 
  query, where, getDoc, serverTimestamp 
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '../../src/config/firebase';

// ? INTERFACES
interface Category {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  productCount: number;
  icon?: string;
}

interface CompanyData {
  name: string;
  logo: string;
  verified: boolean;
  goldSupplier: boolean;
  categories: string[];
  mainCategory: string;
  responseRate: number;
}

// ? FONCTION POUR GÉNÉRER UN SLUG
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100);
};

// ? UPLOAD D'IMAGE SIMPLE ET FIABLE
const uploadImageToFirebase = async (imageUri: string, path: string) => {
  try {
    const storage = getStorage();
    const storageRef = ref(storage, path);
    
    const response = await fetch(imageUri);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const blob = await response.blob();
    if (blob.size === 0) throw new Error('Blob vide - image corrompue');
    
    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);
    
    return downloadURL;
  } catch (error) {
    console.error("?? Erreur upload Firebase:", error);
    throw new Error(`Échec upload image: ${error.message}`);
  }
};

// ? UPLOAD MULTIPLE DES IMAGES
const uploadImagesToFirebase = async (imageUris: string[], userId: string): Promise<string[]> => {
  const uploadedUrls: string[] = [];
  
  for (let i = 0; i < imageUris.length; i++) {
    const imageUri = imageUris[i];
    
    try {
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 10);
      const fileName = `products/${userId}/${timestamp}_${randomId}.jpg`;
      
      const downloadURL = await uploadImageToFirebase(imageUri, fileName);
      uploadedUrls.push(downloadURL);
      
    } catch (error) {
      console.error(`? Erreur image ${i + 1}:`, error);
      
      if (i === 0) {
        throw new Error(`Échec upload image principale: ${error.message}`);
      }
      
      console.warn(`?? Image ${i + 1} ignorée, continuation...`);
    }
  }
  
  if (uploadedUrls.length === 0) {
    throw new Error('Aucune image n\'a pu être uploadée');
  }
  
  return uploadedUrls;
};

// ? COMPOSANT MODAL DE SÉLECTION DE CATÉGORIE
const CategorySelectionModal = ({ 
  visible, 
  onClose, 
  categories, 
  onSelectCategory,
  selectedCategories = []
}: { 
  visible: boolean; 
  onClose: () => void;
  categories: Category[];
  onSelectCategory: (categoryId: string) => void;
  selectedCategories?: string[];
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    cat.isActive !== false
  );

  const getCategoryIcon = (categoryName: string): any => {
    const name = categoryName.toLowerCase();
    if (name.includes('mode') || name.includes('vetement') || name.includes('textile')) return 'shirt';
    if (name.includes('electronique') || name.includes('électronique')) return 'hardware-chip';
    if (name.includes('machin') || name.includes('industriel')) return 'build';
    if (name.includes('aliment') || name.includes('food')) return 'restaurant';
    if (name.includes('construct') || name.includes('bâtiment')) return 'home';
    if (name.includes('santé') || name.includes('medical')) return 'medical';
    if (name.includes('beauté') || name.includes('cosmétique')) return 'sparkles';
    if (name.includes('sport') || name.includes('fitness')) return 'barbell';
    if (name.includes('maison') || name.includes('décor')) return 'bed';
    if (name.includes('auto') || name.includes('voiture')) return 'car';
    if (name.includes('agriculture') || name.includes('ferme')) return 'leaf';
    if (name.includes('chimie') || name.includes('plastique')) return 'flask';
    return 'pricetag';
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={modalStyles.modalOverlay}>
        <View style={modalStyles.modalContent}>
          <View style={modalStyles.modalHeader}>
            <Text style={modalStyles.modalTitle}>Sélectionner une catégorie</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Barre de recherche */}
          <View style={modalStyles.searchContainer}>
            <Ionicons name="search" size={20} color="#999" />
            <TextInput
              style={modalStyles.searchInput}
              placeholder="Rechercher une catégorie..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999"
            />
          </View>

          {/* Liste des catégories */}
          <FlatList
            data={filteredCategories}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            style={modalStyles.categoryList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  modalStyles.categoryItem,
                  selectedCategories.includes(item.id) && modalStyles.categoryItemSelected
                ]}
                onPress={() => {
                  onSelectCategory(item.id);
                  onClose();
                }}
              >
                <View style={modalStyles.categoryIconContainer}>
                  <Ionicons 
                    name={item.icon || getCategoryIcon(item.name)} 
                    size={20} 
                    color={selectedCategories.includes(item.id) ? '#fff' : '#ff6a00'} 
                  />
                </View>
                <View style={modalStyles.categoryTextContainer}>
                  <Text style={[
                    modalStyles.categoryName,
                    selectedCategories.includes(item.id) && modalStyles.categoryNameSelected
                  ]}>
                    {item.name}
                  </Text>
                  {item.description && (
                    <Text style={modalStyles.categoryDescription} numberOfLines={2}>
                      {item.description}
                    </Text>
                  )}
                </View>
                {item.productCount > 0 && (
                  <View style={modalStyles.productCountBadge}>
                    <Text style={modalStyles.productCountText}>
                      {item.productCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={modalStyles.emptyContainer}>
                <Ionicons name="grid-outline" size={48} color="#ccc" />
                <Text style={modalStyles.emptyText}>
                  {searchQuery ? 'Aucune catégorie trouvée' : 'Aucune catégorie disponible'}
                </Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

export default function AddProductScreen() {
  const router = useRouter();
  const { user, userRole } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    originalPrice: '',
    categoryId: '',
    categoryName: '',
    stock: '10',
    sku: '',
    weight: '',
    dimensions: '',
    isActive: true,
    hasVariants: false,
    supplier: '',
    deliveryTime: '3-5 jours',
    minOrder: '1',
    
    // Spécifications B2B
    material: '',
    origin: '',
    warranty: '',
    modelNumber: '',
    color: '',
    usage: '',
    style: '',
    
    // Sections d'affichage
    featured: false,
    trending: false,
    specialOffer: false,
    newArrival: true,
    industrial: false,
    premiumSupplier: false,
    topSelling: false,
    
    // Options B2B
    hasSample: true,
    customization: false,
    privateLabel: false,
    bulkDiscount: false,
    moq: '100', // Minimum Order Quantity
    leadTime: '15-30 jours',
    packaging: 'Standard',
    certifications: '',
  });

  // ? CHARGER LES CATÉGORIES DEPUIS FIRESTORE
  useEffect(() => {
    fetchCategories();
    if (user?.uid) {
      fetchCompanyData(user.uid);
    }
  }, [user]);

  const fetchCategories = async () => {
    try {
      console.log('📥 Chargement des catégories depuis Firestore...');
      const categoriesQuery = query(collection(db, 'categories'));
      const snapshot = await getDocs(categoriesQuery);
      
      const categoriesData: Category[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`📋 Catégorie trouvée: ${data.name} (${doc.id})`);
        categoriesData.push({
          id: doc.id,
          name: data.name,
          description: data.description || '',
          isActive: data.isActive !== false, // Par défaut true si non spécifié
          productCount: data.productCount || 0,
          icon: data.icon
        });
      });
      
      // Trier par nombre de produits (plus populaires en premier)
      categoriesData.sort((a, b) => b.productCount - a.productCount);
      setCategories(categoriesData);
      console.log(`✅ ${categoriesData.length} catégories chargées`);
      
    } catch (error) {
      console.error('❌ Erreur chargement catégories:', error);
      // Fallback sur des catégories basiques
      setCategories([
        { id: 'mode', name: 'Mode & Accessoires', description: '', isActive: true, productCount: 0, icon: 'shirt' },
        { id: 'electronique', name: 'Électronique', description: '', isActive: true, productCount: 0, icon: 'hardware-chip' },
        { id: 'machines', name: 'Machines', description: '', isActive: true, productCount: 0, icon: 'build' },
        { id: 'alimentation', name: 'Alimentation', description: '', isActive: true, productCount: 0, icon: 'restaurant' },
        { id: 'construction', name: 'Construction', description: '', isActive: true, productCount: 0, icon: 'home' },
      ]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchCompanyData = async (userId: string) => {
    try {
      const companyDoc = await getDoc(doc(db, 'companies', userId));
      if (companyDoc.exists()) {
        const data = companyDoc.data();
        setCompanyData({
          name: data.name || 'Mon Entreprise',
          logo: data.logo || '',
          verified: data.verified || data.verification?.verified || false,
          goldSupplier: data.goldSupplier || false,
          categories: data.categories || [],
          mainCategory: data.mainCategory || '',
          responseRate: data.responseRate || 85
        });
        
        // Pré-remplir le fournisseur avec les données de l'entreprise
        setForm(prev => ({
          ...prev,
          supplier: data.name || 'Mon Entreprise'
        }));
      }
    } catch (error) {
      console.error('Erreur chargement entreprise:', error);
    }
  };

  // ? SÉLECTION DES IMAGES
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission requise', 
          'L\'application a besoin d\'accéder à votre galerie pour sélectionner des images.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: 10 - images.length
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newImages = result.assets.map(asset => asset.uri);
        setImages(prev => [...prev, ...newImages].slice(0, 10));
      }

    } catch (error) {
      console.error('? Erreur sélection images:', error);
      Alert.alert('Erreur', 'Impossible d\'accéder à votre galerie.');
    }
  };

  // ? SUPPRIMER IMAGE
  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  // ? SÉLECTIONNER UNE CATÉGORIE
  const handleCategorySelect = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (category) {
      setForm({
        ...form,
        categoryId: category.id,
        categoryName: category.name
      });
      console.log(`✅ Catégorie sélectionnée: ${category.name}`);
    }
  };

  // ? FONCTION CRÉATION PRODUIT AVEC STRUCTURE B2B COMPLÈTE
  const handleSubmit = async () => {
    // VALIDATION AVANCÉE
    if (!form.title.trim()) {
      Alert.alert('Erreur', 'Le titre du produit est requis');
      return;
    }

    if (!form.price || Number(form.price) <= 0) {
      Alert.alert('Erreur', 'Le prix doit être supérieur à 0');
      return;
    }

    if (!form.categoryId) {
      Alert.alert('Erreur', 'Veuillez sélectionner une catégorie');
      return;
    }

    if (images.length === 0) {
      Alert.alert('Images requises', 'Veuillez ajouter au moins une image du produit');
      return;
    }

    if (Number(form.moq) < 1) {
      Alert.alert('Erreur', 'La quantité minimum de commande doit être d\'au moins 1');
      return;
    }

    setLoading(true);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      console.log('?? Début processus création produit B2B...');
      
      // ? UPLOAD DES IMAGES
      const uploadedImageUrls = await uploadImagesToFirebase(images, user?.uid || 'anonymous');
      
      // Simulation de progression
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 15;
        });
      }, 300);

      // ? STRUCTURE COMPLÈTE POUR PRODUITS B2B
      const productData = {
        // === IDENTIFIANTS ET MÉTADONNÉES ===
        id: '', // Firestore générera l'ID
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'published',
        productType: 'physical',
        
        // === INFORMATIONS DE BASE ===
        name: form.title.trim(),
        description: form.description.trim() || `Découvrez notre produit ${form.title.trim()}`,
        shortDescription: form.description.trim().substring(0, 150) || '',
        price: Number(form.price),
        originalPrice: form.originalPrice ? Number(form.originalPrice) : null,
        currency: 'XOF',
        priceUnit: 'unité',
        
        // === IMAGES ===
        images: uploadedImageUrls,
        mainImage: uploadedImageUrls[0],
        thumbnail: uploadedImageUrls[0],
        
        // === CATÉGORISATION ===
        categoryId: form.categoryId,
        categoryName: form.categoryName,
        categories: companyData?.categories || [],
        mainCategory: form.categoryId,
        tags: [],
        keywords: form.title.trim().toLowerCase().split(' '),
        
        // === RELATION AVEC LE FOURNISSEUR ===
        sellerId: user?.uid || '',
        sellerName: form.supplier.trim(),
        sellerLogo: companyData?.logo || user?.photoURL || '',
        companyId: user?.uid || '',
        companyName: companyData?.name || form.supplier.trim(),
        companyVerified: companyData?.verified || false,
        companyGoldSupplier: companyData?.goldSupplier || false,
        companyResponseRate: companyData?.responseRate || 85,
        
        // === SPÉCIFICATIONS TECHNIQUES B2B ===
        specifications: {
          material: form.material,
          origin: form.origin || 'Importé',
          warranty: form.warranty || '1 an',
          modelNumber: form.modelNumber || form.sku || `MODEL-${Date.now()}`,
          weight: form.weight ? `${form.weight} kg` : '',
          dimensions: form.dimensions,
          color: form.color,
          usage: form.usage,
          style: form.style,
          packaging: form.packaging,
          certifications: form.certifications ? form.certifications.split(',').map(c => c.trim()) : []
        },
        
        // === STOCK ET COMMANDE B2B ===
        stockQuantity: Number(form.stock) || 10,
        minOrder: Number(form.minOrder) || 1,
        moq: Number(form.moq) || 100,
        maxOrder: null,
        inStock: form.isActive,
        lowStockThreshold: 5,
        
        // === OPTIONS B2B ===
        hasSample: form.hasSample,
        customizationAvailable: form.customization,
        privateLabelAvailable: form.privateLabel,
        bulkDiscount: form.bulkDiscount,
        bulkDiscountRates: form.bulkDiscount ? [
          { quantity: 100, discount: 5 },
          { quantity: 500, discount: 10 },
          { quantity: 1000, discount: 15 }
        ] : [],
        
        // === LIVRAISON B2B ===
        shippingCost: 0,
        deliveryTime: form.deliveryTime,
        leadTime: form.leadTime,
        shippingMethods: ['Express', 'Standard', 'Sea Freight'],
        fobPort: 'Abidjan, Côte d\'Ivoire',
        paymentTerms: ['T/T', 'L/C', 'Western Union', 'Escrow'],
        
        // === AVIS ET NOTATION ===
        rating: 0,
        reviewCount: 0,
        soldCount: 0,
        inquiryCount: 0,
        
        // === GESTION DES PROMOTIONS ===
        onSale: form.originalPrice && form.price ? Number(form.price) < Number(form.originalPrice) : false,
        salePrice: form.originalPrice && form.price ? Number(form.price) : null,
        discountPercentage: form.originalPrice && form.price ? 
          Math.round((1 - Number(form.price) / Number(form.originalPrice)) * 100) : 0,
        saleEndDate: null,
        
        // === MÉTADONNÉES DE CRÉATION ===
        createdBy: userRole === 'admin' ? 'admin' : 'company',
        creatorId: user?.uid || 'anonymous',
        isVerified: userRole === 'admin',
        approvalStatus: 'approved',
        
        // === SECTIONS D'AFFICHAGE ===
        featured: form.featured,
        trending: form.trending,
        specialOffer: form.specialOffer,
        newArrival: form.newArrival,
        industrial: form.industrial,
        premiumSupplier: form.premiumSupplier,
        topSelling: form.topSelling,
        recommended: false,
        
        // === SEO ET VISIBILITÉ ===
        slug: generateSlug(form.title.trim()),
        metaTitle: form.title.trim(),
        metaDescription: form.description.trim().substring(0, 160) || '',
        metaKeywords: form.title.trim().toLowerCase().split(' ').join(', '),
        
        // === STATISTIQUES ===
        viewCount: 0,
        favoriteCount: 0,
        shareCount: 0,
        clickCount: 0,
        
        // === CHAMPS COMPLÉMENTAIRES ===
        hasVariants: form.hasVariants,
        variantOptions: form.hasVariants ? [
          { name: 'Couleur', values: ['Rouge', 'Bleu', 'Vert'] },
          { name: 'Taille', values: ['S', 'M', 'L', 'XL'] }
        ] : [],
        
        // === POUR ANALYTIQUES ===
        lastViewed: null,
        lastSold: null,
        
        // === COMPATIBILITÉ ===
        isActive: form.isActive,
        isDeleted: false,
        isDraft: false
      };

      console.log('?? Création produit B2B Firestore...');
      const docRef = await addDoc(collection(db, 'products'), productData);
      
      // Mettre à jour l'ID du document
      await updateDoc(docRef, { id: docRef.id });
      
      // Mettre à jour le compteur de produits dans la catégorie
      await updateCategoryProductCount(form.categoryId);
      
      // Mettre à jour le compteur de produits de l'entreprise
      await updateCompanyProductCount(user?.uid || '');
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      console.log('?? Produit B2B créé avec ID:', docRef.id);

      // SUCCÈS AVEC OPTIONS B2B
      Alert.alert(
        'Produit créé avec succès! ??',
        `"${form.title}" a été ajouté à la marketplace B2B.`,
        [
          {
            text: 'Voir le produit',
            onPress: () => router.push(`/product/${docRef.id}`)
          },
          {
            text: 'Créer un autre',
            style: 'cancel',
            onPress: () => resetForm()
          },
          {
            text: 'Dashboard',
            onPress: () => router.push('/seller/dashboard')
          }
        ]
      );

    } catch (error) {
      console.error('? Erreur création produit:', error);
      
      let errorMessage = 'Impossible de créer le produit. ';
      if (error.message.includes('network')) {
        errorMessage += 'Vérifiez votre connexion internet.';
      } else if (error.message.includes('upload')) {
        errorMessage += 'Problème avec les images.';
      } else {
        errorMessage += error.message;
      }
      
      Alert.alert('Erreur', errorMessage);
      
    } finally {
      setLoading(false);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // ? METTRE À JOUR LE COMPTEUR DE PRODUITS DANS LA CATÉGORIE
  const updateCategoryProductCount = async (categoryId: string) => {
    try {
      const categoryRef = doc(db, 'categories', categoryId);
      const categoryDoc = await getDoc(categoryRef);
      
      if (categoryDoc.exists()) {
        const currentCount = categoryDoc.data().productCount || 0;
        await updateDoc(categoryRef, {
          productCount: currentCount + 1,
          updatedAt: serverTimestamp()
        });
        console.log(`✅ Compteur catégorie ${categoryId} incrémenté`);
      }
    } catch (error) {
      console.error('Erreur mise à jour compteur catégorie:', error);
    }
  };

  // ? METTRE À JOUR LE COMPTEUR DE PRODUITS DE L'ENTREPRISE
  const updateCompanyProductCount = async (companyId: string) => {
    try {
      const companyRef = doc(db, 'companies', companyId);
      const companyDoc = await getDoc(companyRef);
      
      if (companyDoc.exists()) {
        const currentStats = companyDoc.data().stats || {};
        await updateDoc(companyRef, {
          'stats.productCount': (currentStats.productCount || 0) + 1,
          updatedAt: serverTimestamp()
        });
        console.log(`✅ Compteur produits entreprise ${companyId} incrémenté`);
      }
    } catch (error) {
      console.error('Erreur mise à jour compteur entreprise:', error);
    }
  };

  // ? RÉINITIALISER LE FORMULAIRE
  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      price: '',
      originalPrice: '',
      categoryId: '',
      categoryName: '',
      stock: '10',
      sku: '',
      weight: '',
      dimensions: '',
      isActive: true,
      hasVariants: false,
      supplier: companyData?.name || '',
      deliveryTime: '3-5 jours',
      minOrder: '1',
      
      material: '',
      origin: '',
      warranty: '',
      modelNumber: '',
      color: '',
      usage: '',
      style: '',
      
      featured: false,
      trending: false,
      specialOffer: false,
      newArrival: true,
      industrial: false,
      premiumSupplier: false,
      topSelling: false,
      
      hasSample: true,
      customization: false,
      privateLabel: false,
      bulkDiscount: false,
      moq: '100',
      leadTime: '15-30 jours',
      packaging: 'Standard',
      certifications: '',
    });
    setImages([]);
  };

  // ? COMPOSANT TOGGLE B2B
  const B2BToggle = ({ label, value, onValueChange, description, icon }) => (
    <View style={styles.toggleContainer}>
      <View style={styles.toggleIconContainer}>
        <Ionicons name={icon} size={20} color={value ? '#ff6a00' : '#999'} />
      </View>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#ddd', true: '#ffd8b4' }}
        thumbColor={value ? '#ff6a00' : '#f4f3f4'}
      />
    </View>
  );

  // ? COMPOSANT INPUT B2B
  const B2BInput = ({ label, value, onChangeText, placeholder, keyboardType = 'default' }) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Nouveau Produit B2B</Text>
          {companyData && (
            <Text style={styles.companyName}>{companyData.name}</Text>
          )}
        </View>
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
              : 'Création du produit B2B...'
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
        {/* En-tête B2B */}
        <View style={styles.b2bHeader}>
          <Ionicons name="business" size={24} color="#007AFF" />
          <Text style={styles.b2bHeaderText}>Formulaire Professionnel B2B</Text>
        </View>

        {/* Section Photos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>?? Photos du produit</Text>
            <Text style={styles.requiredLabel}>(Minimum 1, Maximum 10)</Text>
          </View>
          
          <Text style={styles.sectionSubtitle}>
            {images.length > 0 
              ? `${images.length} image(s) - ${images.length >= 3 ? '✅ Idéal pour B2B' : 'Ajoutez plus d\'angles'}`
              : 'Images haute qualité augmentent les conversions B2B'
            }
          </Text>
          
          <TouchableOpacity style={styles.uploadArea} onPress={pickImage}>
            <Ionicons name="camera-outline" size={48} color="#CCC" />
            <Text style={styles.uploadText}>
              {images.length > 0 ? 'Ajouter plus de photos' : '+ Ajouter des photos'}
            </Text>
            <Text style={styles.uploadHint}>10 maximum • JPEG, PNG • 4:3 recommandé</Text>
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
              {images.length < 10 && (
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
          <Text style={styles.sectionTitle}>?? Informations de base</Text>
          
          <B2BInput
            label="Titre du produit *"
            value={form.title}
            onChangeText={(text) => setForm({...form, title: text})}
            placeholder="Ex: Machine à couvercles CNC 3 axes"
          />

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description détaillée *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Décrivez les caractéristiques techniques, spécifications, avantages..."
              multiline
              numberOfLines={4}
              value={form.description}
              onChangeText={(text) => setForm({...form, description: text})}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Prix (F CFA) *</Text>
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

          {/* Sélection de catégorie améliorée */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Catégorie * {form.categoryName && `- ${form.categoryName}`}
            </Text>
            <TouchableOpacity 
              style={[styles.picker, form.categoryName && styles.pickerSelected]}
              onPress={() => setShowCategoryModal(true)}
            >
              <Ionicons name="pricetag-outline" size={18} color={form.categoryName ? '#ff6a00' : '#999'} />
              <Text style={form.categoryName ? styles.pickerTextSelected : styles.pickerText}>
                {form.categoryName || 'Sélectionner une catégorie'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#999" />
            </TouchableOpacity>
            
            {companyData?.categories && companyData.categories.length > 0 && (
              <View style={styles.companyCategories}>
                <Text style={styles.companyCategoriesTitle}>Catégories de votre entreprise:</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.categoryChips}
                >
                  {companyData.categories.slice(0, 10).map((catId, index) => {
                    const category = categories.find(c => c.id === catId);
                    return category ? (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.categoryChip,
                          form.categoryId === catId && styles.categoryChipActive
                        ]}
                        onPress={() => handleCategorySelect(catId)}
                      >
                        <Text style={[
                          styles.categoryChipText,
                          form.categoryId === catId && styles.categoryChipTextActive
                        ]}>
                          {category.name}
                        </Text>
                      </TouchableOpacity>
                    ) : null;
                  })}
                </ScrollView>
                
                {/* Message si plus de 10 catégories */}
                {companyData.categories.length > 10 && (
                  <TouchableOpacity 
                    style={styles.seeAllButton}
                    onPress={() => setShowCategoryModal(true)}
                  >
                    <Text style={styles.seeAllText}>
                      + {companyData.categories.length - 10} autres catégories disponibles
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Quantité minimum (MOQ) *</Text>
              <TextInput
                style={styles.input}
                placeholder="100"
                keyboardType="numeric"
                value={form.moq}
                onChangeText={(text) => setForm({...form, moq: text})}
              />
              <Text style={styles.hint}>Quantité minimum de commande</Text>
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Délai de production</Text>
              <TextInput
                style={styles.input}
                placeholder="15-30 jours"
                value={form.leadTime}
                onChangeText={(text) => setForm({...form, leadTime: text})}
              />
              <Text style={styles.hint}>Délai après commande</Text>
            </View>
          </View>
        </View>

        {/* Spécifications techniques B2B */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>?? Spécifications techniques</Text>
          
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Matériau</Text>
              <TextInput
                style={styles.input}
                value={form.material}
                onChangeText={(text) => setForm({...form, material: text})}
                placeholder="Acier, plastique, aluminium..."
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Origine</Text>
              <TextInput
                style={styles.input}
                value={form.origin}
                onChangeText={(text) => setForm({...form, origin: text})}
                placeholder="Chine, UE, Local..."
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Garantie</Text>
              <TextInput
                style={styles.input}
                value={form.warranty}
                onChangeText={(text) => setForm({...form, warranty: text})}
                placeholder="1 an, 2 ans..."
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Numéro de modèle</Text>
              <TextInput
                style={styles.input}
                value={form.modelNumber}
                onChangeText={(text) => setForm({...form, modelNumber: text})}
                placeholder="MOD-2024-001"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Certifications (séparées par des virgules)</Text>
            <TextInput
              style={styles.input}
              value={form.certifications}
              onChangeText={(text) => setForm({...form, certifications: text})}
              placeholder="ISO 9001, CE, RoHS, FDA"
            />
          </View>
        </View>

        {/* Options B2B */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>?? Options B2B</Text>
          <Text style={styles.sectionSubtitle}>
            Ces options augmentent votre attractivité pour les acheteurs professionnels
          </Text>

          <B2BToggle
            label="Échantillons disponibles"
            value={form.hasSample}
            onValueChange={(value) => setForm({...form, hasSample: value})}
            description="Proposer des échantillons aux acheteurs sérieux"
            icon="cube-outline"
          />

          <B2BToggle
            label="Personnalisation possible"
            value={form.customization}
            onValueChange={(value) => setForm({...form, customization: value})}
            description="Adaptez le produit aux besoins du client"
            icon="color-palette-outline"
          />

          <B2BToggle
            label="Marque privée"
            value={form.privateLabel}
            onValueChange={(value) => setForm({...form, privateLabel: value})}
            description="Ajoutez le logo du client"
            icon="bag-add-outline"
          />

          <B2BToggle
            label="Remises sur volume"
            value={form.bulkDiscount}
            onValueChange={(value) => setForm({...form, bulkDiscount: value})}
            description="Réductions pour grosses commandes"
            icon="trending-down-outline"
          />
        </View>

        {/* Sections d'affichage */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>?? Sections d'affichage</Text>
          <Text style={styles.sectionSubtitle}>
            Choisissez où votre produit apparaîtra sur la marketplace
          </Text>

          <B2BToggle
            label="?? Vedette sur l'accueil"
            value={form.featured}
            onValueChange={(value) => setForm({...form, featured: value})}
            description="Produit mis en avant en haut de page"
            icon="star-outline"
          />

          <B2BToggle
            label="?? Tendances"
            value={form.trending}
            onValueChange={(value) => setForm({...form, trending: value})}
            description="Section populaire du moment"
            icon="trending-up-outline"
          />

          <B2BToggle
            label="?? Offres spéciales"
            value={form.specialOffer}
            onValueChange={(value) => setForm({...form, specialOffer: value})}
            description="Pour les promotions et soldes"
            icon="flash-outline"
          />

          <B2BToggle
            label="?? Machines industrielles"
            value={form.industrial}
            onValueChange={(value) => setForm({...form, industrial: value})}
            description="Section équipements professionnels"
            icon="build-outline"
          />

          <B2BToggle
            label="?? Nouveautés"
            value={form.newArrival}
            onValueChange={(value) => setForm({...form, newArrival: value})}
            description="Tous les nouveaux produits (recommandé)"
            icon="sparkles-outline"
          />

          <B2BToggle
            label="?? Meilleures ventes"
            value={form.topSelling}
            onValueChange={(value) => setForm({...form, topSelling: value})}
            description="Section des produits les plus vendus"
            icon="trophy-outline"
          />

          <B2BToggle
            label="? Fournisseurs premium"
            value={form.premiumSupplier}
            onValueChange={(value) => setForm({...form, premiumSupplier: value})}
            description="Visible uniquement si vous êtes Gold Supplier"
            icon="diamond-outline"
          />
        </View>

        {/* Stock et inventaire */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>?? Stock et inventaire</Text>
          
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
            <Text style={styles.label}>Référence SKU/Code produit</Text>
            <TextInput
              style={styles.input}
              placeholder="MACH-CNC-2024-001"
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
          <Text style={styles.sectionTitle}>?? Informations livraison</Text>
          
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

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Conditionnement</Text>
            <TextInput
              style={styles.input}
              placeholder="Carton, palette, emballage individuel..."
              value={form.packaging}
              onChangeText={(text) => setForm({...form, packaging: text})}
            />
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
              <Text style={styles.submitButtonText}>Créer le produit B2B</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.spacer} />
      </ScrollView>

      {/* Modal de sélection de catégorie */}
      <CategorySelectionModal
        visible={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        categories={categories}
        onSelectCategory={handleCategorySelect}
        selectedCategories={form.categoryId ? [form.categoryId] : []}
      />
    </SafeAreaView>
  );
}

// ? STYLES PRINCIPAUX
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    backgroundColor: '#fff'
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  companyName: {
    fontSize: 12, color: '#666', marginTop: 2,
    fontStyle: 'italic'
  },
  publishButton: { fontSize: 16, fontWeight: '600', color: '#FF6B00' },
  publishButtonDisabled: { opacity: 0.5 },
  content: { flex: 1 },
  b2bHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#f0f7ff',
    borderBottomWidth: 1,
    borderBottomColor: '#d1e7ff',
  },
  b2bHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 8,
  },
  section: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginRight: 8 },
  sectionSubtitle: { fontSize: 14, color: '#666', marginBottom: 16 },
  requiredLabel: { fontSize: 12, color: '#FF4444', fontWeight: '600' },
  uploadArea: {
    height: 120, borderWidth: 2, borderColor: '#E0E0E0', borderStyle: 'dashed',
    borderRadius: 12, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F8F9FA', marginBottom: 16,
  },
  uploadText: { fontSize: 16, color: '#666', marginTop: 8, fontWeight: '500' },
  uploadHint: { fontSize: 12, color: '#999', marginTop: 4 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  photoItem: { width: 100, height: 100, borderRadius: 8, position: 'relative' },
  photoImage: { width: '100%', height: '100%', borderRadius: 8 },
  mainImageBadge: {
    position: 'absolute', top: 4, left: 4, backgroundColor: '#FF6B00',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  mainImageText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  removePhotoButton: {
    position: 'absolute', top: -6, right: -6, backgroundColor: '#FFF',
    borderRadius: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2, shadowRadius: 2, elevation: 2,
  },
  photoSlot: {
    width: 100, height: 100, backgroundColor: '#F8F9FA', borderRadius: 8,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0',
  },
  photoSlotText: { fontSize: 12, color: '#999', marginTop: 4 },
  inputGroup: { marginBottom: 16, position: 'relative' },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  required: { color: '#FF4444' },
  input: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 12,
    fontSize: 16, backgroundColor: '#FFF',
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },
  picker: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 12, 
    backgroundColor: '#FFF', gap: 8
  },
  pickerSelected: {
    borderColor: '#ff6a00', backgroundColor: '#fff8f0'
  },
  pickerText: { fontSize: 16, color: '#999', flex: 1 },
  pickerTextSelected: { fontSize: 16, color: '#333', flex: 1, fontWeight: '500' },
  companyCategories: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee'
  },
  companyCategoriesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8
  },
  categoryChips: {
    flexDirection: 'row',
    paddingVertical: 8,
    maxHeight: 50,
  },
  categoryChip: {
    backgroundColor: '#e8f4ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#b8d4ff',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#ff6a00',
    borderColor: '#ff6a00',
  },
  categoryChipText: {
    fontSize: 12,
    color: '#007AFF',
  },
  categoryChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  seeAllButton: {
    marginTop: 4,
    padding: 8,
  },
  seeAllText: {
    fontSize: 12,
    color: '#007AFF',
    fontStyle: 'italic',
  },
  toggleContainer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  toggleIconContainer: {
    width: 30,
    alignItems: 'center'
  },
  toggleText: { flex: 1, marginRight: 12, marginLeft: 12 },
  toggleLabel: { fontSize: 16, fontWeight: '500', color: '#1A1A1A', marginBottom: 4 },
  toggleDescription: { fontSize: 12, color: '#6c757d' },
  switchGroup: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16,
  },
  switchLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 2 },
  switchDescription: { fontSize: 12, color: '#666' },
  submitButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FF6B00', margin: 16, padding: 16, borderRadius: 8, gap: 8,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)', justifyContent: 'center',
    alignItems: 'center', zIndex: 1000,
  },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666', fontWeight: '600' },
  loadingSubtext: { marginTop: 8, fontSize: 14, color: '#999' },
  progressBar: {
    width: '80%', height: 6, backgroundColor: '#E0E0E0', borderRadius: 3,
    marginTop: 16, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#FF6B00', borderRadius: 3 },
  spacer: { height: 20 },
  hint: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic'
  }
});

// ? STYLES POUR LE MODAL DE CATÉGORIE
const modalStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#f8f9fa',
  },
  
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  
  categoryList: {
    maxHeight: 400,
  },
  
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f8f8',
  },
  
  categoryItemSelected: {
    backgroundColor: '#fff8f0',
  },
  
  categoryIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff0e6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  
  categoryTextContainer: {
    flex: 1,
  },
  
  categoryName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  
  categoryNameSelected: {
    color: '#ff6a00',
    fontWeight: '600',
  },
  
  categoryDescription: {
    fontSize: 12,
    color: '#666',
  },
  
  productCountBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  
  productCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});