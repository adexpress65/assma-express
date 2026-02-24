// apps/mobile/app/super-admin/add-product.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, SafeAreaView, ScrollView, 
  TextInput, TouchableOpacity, Alert, Switch, Image,
  ActivityIndicator, Linking, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { collection, addDoc, getDocs, query, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/contexts/AuthContext';
import { db, storage } from '@/config/firebase';

// ? FONCTION POUR GÉNÉRER UN SLUG
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100);
};

// ✅ FONCTION UPLOAD D'IMAGES (NE TÉLÉCHARGE QUE LES NOUVELLES IMAGES)
const uploadImagesToFirebase = async (images: string[], userId: string): Promise<string[]> => {
  console.log(`🔥 Upload de ${images.length} image(s) pour user: ${userId}`);
  
  const uploadPromises = images.map(async (imageUri, index) => {
    try {
      if (imageUri.startsWith('https://firebasestorage.googleapis.com')) {
        console.log(`🔥 ✅ Image ${index + 1} déjà sur Firebase, conservation de l'URL`);
        return imageUri;
      }

      console.log(`🔥 Conversion de l'image ${index + 1}...`);
      const response = await fetch(imageUri);
      
      if (!response.ok) {
        throw new Error(`Fetch failed: ${response.status}`);
      }

      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error('Blob vide (0 bytes)');
      }

      const timestamp = Date.now();
      const fileName = `product_${userId}_${timestamp}_${index}.jpg`;
      const storagePath = `products/${fileName}`;
      
      console.log(`🔥 Upload de ${fileName}...`);
      const storageRef = ref(storage, storagePath);
      
      await uploadBytes(storageRef, blob, {
        contentType: blob.type || 'image/jpeg',
      });

      const downloadURL = await getDownloadURL(storageRef);
      console.log(`🔥 ✅ Image ${index + 1} uploadée avec succès`);
      
      blob.close?.();
      return downloadURL;
      
    } catch (error: any) {
      console.error(`🔥 ERREUR upload image ${index + 1}:`, error);
      throw error;
    }
  });

  return await Promise.all(uploadPromises);
};

// ? FONCTION POUR GÉNÉRER UN SKU UNIQUE
const generateSku = (productName: string, color: string, size: string): string => {
  const base = productName.trim().toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '');
  const colorCode = color.trim().toUpperCase().substring(0, 3);
  const sizeCode = size.trim().toUpperCase();
  return `${base}-${colorCode}-${sizeCode}-${Date.now().toString().slice(-4)}`;
};

export default function AddProductScreen() {
  const router = useRouter();
  const { user, userRole } = useAuth();
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const isEditMode = !!productId;
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  
  // --- ÉTATS POUR LES VARIANTES ---
  const [variantColors, setVariantColors] = useState<string[]>([]);
  const [variantSizes, setVariantSizes] = useState<string[]>([]);
  const [newColor, setNewColor] = useState('');
  const [newSize, setNewSize] = useState('');
  
  // --- AJUSTEMENT DE PRIX RAPIDE (OPTIONNEL) ---
  const [priceAdjustment, setPriceAdjustment] = useState<number>(0);
  
  // --- ÉTATS POUR LES ENTREPRISES ---
  const [companies, setCompanies] = useState<any[]>([]);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);

  // --- ÉTATS POUR LES CATÉGORIES DYNAMIQUES ---
  const [categoriesDB, setCategoriesDB] = useState<{id: string, name: string}[]>([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [filteredCategories, setFilteredCategories] = useState<{id: string, name: string}[]>([]);

  // --- ÉTATS POUR LA PERSONNALISATION ---
  const [hasPersonalization, setHasPersonalization] = useState(false);
  const [personalizationFields, setPersonalizationFields] = useState([
    { id: 'name', label: 'Nom complet', type: 'text', required: true, enabled: true },
    { id: 'email', label: 'Email', type: 'email', required: true, enabled: true },
    { id: 'phone', label: 'Téléphone', type: 'tel', required: false, enabled: true },
    { id: 'message', label: 'Message personnalisé', type: 'textarea', required: false, enabled: true },
    { id: 'date', label: 'Date souhaitée', type: 'date', required: false, enabled: false },
    { id: 'color', label: 'Couleur préférée', type: 'text', required: false, enabled: false },
  ]);
  const [showPersonalizationModal, setShowPersonalizationModal] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  // --- ÉTATS POUR LA GESTION DE LA LIVRAISON GRATUITE ---
  const [hasFreeShipping, setHasFreeShipping] = useState(false);

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
    deliveryTime: '3-5 jours',
    minOrder: '1',
    featured: false,
    trending: false,
    specialOffer: false,
    newArrival: true,
    industrial: false,
    premiumSupplier: false,
  });

  // --- CALCUL DU PRIX FINAL ---
  const basePrice = Number(form.price) || 0;
  const finalPrice = basePrice + priceAdjustment;
  
  // --- CALCUL DU NOMBRE DE VARIANTES ---
  const variantCount = variantColors.length * variantSizes.length;

  // --- FILTRAGE DES CATÉGORIES ---
  useEffect(() => {
    if (categorySearch.trim() === '') {
      setFilteredCategories(categoriesDB);
    } else {
      const filtered = categoriesDB.filter(cat => 
        cat.name.toLowerCase().includes(categorySearch.toLowerCase())
      );
      setFilteredCategories(filtered);
    }
  }, [categorySearch, categoriesDB]);

  // --- CHARGEMENT DES CATÉGORIES DEPUIS FIRESTORE ---
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        console.log('🔍 Chargement des catégories depuis Firestore...');
        const q = query(collection(db, 'categories'), orderBy('name', 'asc'));
        const querySnapshot = await getDocs(q);
        const categoriesList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || 'Sans nom'
        }));
        console.log(`✅ ${categoriesList.length} catégories chargées`);
        setCategoriesDB(categoriesList);
        setFilteredCategories(categoriesList);
      } catch (error) {
        console.error("❌ Erreur lors du chargement des catégories:", error);
      }
    };
    
    fetchCategories();
  }, []);

  // --- CHARGEMENT DES DONNÉES DU PRODUIT EN MODIFICATION ---
  useEffect(() => {
    if (isEditMode && productId) {
      loadProductData();
    }
  }, [productId]);

  const loadProductData = async () => {
    try {
      console.log(`🔍 Chargement du produit ${productId} pour modification...`);
      const productDoc = await getDoc(doc(db, 'products', productId));
      
      if (!productDoc.exists()) {
        Alert.alert('Erreur', 'Produit non trouvé');
        router.back();
        return;
      }

      const productData = productDoc.data();
      
      setForm({
        title: productData.name || '',
        description: productData.description || '',
        price: productData.basePrice?.toString() || productData.price?.toString() || '',
        originalPrice: productData.originalPrice?.toString() || '',
        category: productData.categoryName || '',
        stock: productData.stockQuantity?.toString() || '10',
        sku: productData.specifications?.modelNumber || '',
        weight: productData.specifications?.weight || '',
        dimensions: productData.specifications?.dimensions || '',
        isActive: productData.isActive ?? true,
        deliveryTime: productData.deliveryTime || '3-5 jours',
        minOrder: productData.minOrder?.toString() || '1',
        featured: productData.featured || false,
        trending: productData.trending || false,
        specialOffer: productData.specialOffer || false,
        newArrival: productData.newArrival ?? true,
        industrial: productData.industrial || false,
        premiumSupplier: productData.premiumSupplier || false,
      });

      if (productData.images && Array.isArray(productData.images)) {
        setImages(productData.images);
      }

      if (productData.variantAttributes) {
        const colorsAttr = productData.variantAttributes.find((attr: any) => attr.name === "Color");
        const sizesAttr = productData.variantAttributes.find((attr: any) => attr.name === "Size");
        
        if (colorsAttr && colorsAttr.values) {
          setVariantColors(colorsAttr.values);
        }
        
        if (sizesAttr && sizesAttr.values) {
          setVariantSizes(sizesAttr.values);
        }
      }

      if (productData.companyId) {
        try {
          const companyDoc = await getDoc(doc(db, 'companies', productData.companyId));
          if (companyDoc.exists()) {
            setSelectedCompany({
              id: companyDoc.id,
              ...companyDoc.data()
            });
          }
        } catch (error) {
          console.error('Erreur chargement entreprise:', error);
        }
      }

      if (productData.priceAdjustment) {
        setPriceAdjustment(productData.priceAdjustment);
      }

      // Chargement de la livraison gratuite
      if (productData.hasFreeShipping !== undefined) {
        setHasFreeShipping(productData.hasFreeShipping);
      }

      // Chargement des données de personnalisation
      if (productData.personalization) {
        setHasPersonalization(productData.personalization.enabled || false);
        if (productData.personalization.fields) {
          const loadedFields = productData.personalization.fields;
          setPersonalizationFields(prev => {
            const defaultFields = prev.filter(f => !f.id.startsWith('custom_'));
            const customFields = loadedFields.filter((f: any) => f.id.startsWith('custom_'));
            
            const updatedDefaultFields = defaultFields.map(defaultField => {
              const loadedField = loadedFields.find((f: any) => f.id === defaultField.id);
              return loadedField || defaultField;
            });
            
            return [...updatedDefaultFields, ...customFields];
          });
        }
      }

      console.log('✅ Produit chargé avec succès');
      
    } catch (error) {
      console.error('❌ Erreur chargement produit:', error);
      Alert.alert('Erreur', 'Impossible de charger les données du produit');
    } finally {
      setInitialLoading(false);
    }
  };

  // --- CHARGEMENT DES ENTREPRISES ---
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        console.log('🔍 Chargement des entreprises depuis Firestore...');
        const q = query(collection(db, 'companies'), orderBy('name', 'asc'));
        const querySnapshot = await getDocs(q);
        const companiesList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log(`✅ ${companiesList.length} entreprises chargées`);
        setCompanies(companiesList);
      } catch (error) {
        console.error("❌ Erreur lors de la récupération des entreprises:", error);
        Alert.alert('Erreur', 'Impossible de charger la liste des entreprises');
      }
    };
    
    fetchCompanies();
  }, []);

  // ✅ DEBUG STORAGE BUCKET
  useEffect(() => {
    console.log('🧪 DEBUG STORAGE BUCKET');
    console.log('🧪 Storage object exists:', !!storage);
    if (storage) {
      console.log('🧪 Storage app exists:', !!storage.app);
      console.log('🧪 Storage Bucket:', storage.app?.options?.storageBucket);
    }
  }, []);

  // --- FONCTIONS POUR GÉRER LES VARIANTES ---
  const addColor = () => {
    if (newColor.trim() && !variantColors.includes(newColor.trim())) {
      setVariantColors([...variantColors, newColor.trim()]);
      setNewColor('');
    }
  };

  const removeColor = (color: string) => {
    setVariantColors(variantColors.filter(c => c !== color));
  };

  const addSize = () => {
    if (newSize.trim() && !variantSizes.includes(newSize.trim())) {
      setVariantSizes([...variantSizes, newSize.trim()]);
      setNewSize('');
    }
  };

  const removeSize = (size: string) => {
    setVariantSizes(variantSizes.filter(s => s !== size));
  };

  // --- FONCTIONS POUR LA PERSONNALISATION ---
  const togglePersonalizationField = (fieldId: string) => {
    setPersonalizationFields(prev =>
      prev.map(field =>
        field.id === fieldId ? { ...field, enabled: !field.enabled } : field
      )
    );
  };

  const updateFieldLabel = (fieldId: string, newLabel: string) => {
    setPersonalizationFields(prev =>
      prev.map(field =>
        field.id === fieldId ? { ...field, label: newLabel } : field
      )
    );
  };

  const updateFieldRequired = (fieldId: string) => {
    setPersonalizationFields(prev =>
      prev.map(field =>
        field.id === fieldId ? { ...field, required: !field.required } : field
      )
    );
  };

  const addCustomField = () => {
    if (!newFieldLabel.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir un nom pour le champ');
      return;
    }

    const newField = {
      id: `custom_${Date.now()}`,
      label: newFieldLabel.trim(),
      type: newFieldType,
      required: false,
      enabled: true,
    };

    setPersonalizationFields([...personalizationFields, newField]);
    setNewFieldLabel('');
    setNewFieldType('text');
    setShowPersonalizationModal(false);
  };

  const removeCustomField = (fieldId: string) => {
    if (!fieldId.startsWith('custom_')) {
      Alert.alert('Info', 'Ce champ ne peut pas être supprimé, mais vous pouvez le désactiver');
      return;
    }
    
    setPersonalizationFields(prev => prev.filter(field => field.id !== fieldId));
  };

  // --- GÉNÉRATION DES VARIANTES ---
  const generateVariants = () => {
    const variants = [];
    
    variantColors.forEach(color => {
      variantSizes.forEach(size => {
        variants.push({
          id: `${color.toLowerCase().replace(/\s+/g, '-')}-${size.toLowerCase().replace(/\s+/g, '-')}`,
          color: color,
          size: size,
          price: finalPrice,
          stock: Number(form.stock) || 10,
          image: images.length > 0 ? images[0] : '',
          sku: generateSku(form.title, color, size),
          createdAt: new Date(),
          isActive: form.isActive,
          basePrice: basePrice,
          priceAdjustment: priceAdjustment
        });
      });
    });
    
    return variants;
  };

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

  // ✅ FONCTION HANDLESUBMIT AVEC LOGIQUE HYBRIDE
  const handleSubmit = async () => {
    console.log(`🔥🔥🔥 ${isEditMode ? 'MODIFICATION' : 'CRÉATION'} PRODUIT 🔥🔥🔥`);
    
    if (!form.title.trim()) {
      Alert.alert('Erreur', 'Le titre du produit est requis');
      return;
    }

    if (!form.price || Number(form.price) <= 0) {
      Alert.alert('Erreur', 'Le prix de base doit être supérieur à 0');
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

    if (!selectedCompany) {
      Alert.alert('Erreur', 'Veuillez sélectionner l\'entreprise propriétaire de ce produit');
      return;
    }

    if (variantColors.length === 0 || variantSizes.length === 0) {
      Alert.alert('Erreur', 'Veuillez ajouter au moins une couleur et une taille pour les variantes');
      return;
    }

    if (!user || !user.uid) {
      console.log('🔥 ❌ ERREUR: USER NON PRÊT');
      Alert.alert('Erreur', 'Vous devez être connecté pour créer un produit');
      return;
    }

    setLoading(true);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      console.log(`🔥 ${isEditMode ? 'Modification' : 'Création'} produit pour entreprise:`, selectedCompany.name);
      
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => prev < 90 ? prev + 10 : 90);
      }, 200);

      console.log(`🔥 Upload ${images.length} image(s)...`);
      const uploadedImageUrls = await uploadImagesToFirebase(images, user.uid);
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      console.log(`🔥 Génération de ${variantCount} variantes...`);
      const variants = generateVariants();
      
      const variantsWithImages = variants.map(variant => ({
        ...variant,
        image: uploadedImageUrls[0]
      }));

      const variantAttributes = [
        { name: "Color", values: variantColors },
        { name: "Size", values: variantSizes }
      ];

      // On prépare les données
      // 🔒 Vérification vendeur AVANT écriture Firestore
      if (!selectedCompany?.id) {
        Alert.alert("Erreur", "Impossible de déterminer le vendeur");
        return;
      }
      
      const productData = {
        id: isEditMode ? productId : "", 
        
        name: form.title.trim(),
        nameLower: form.title.trim().toLowerCase(),
        description: form.description.trim() || `Découvrez notre produit ${form.title.trim()}`,
        price: finalPrice,
        basePrice: basePrice,
        originalPrice: form.originalPrice ? Number(form.originalPrice) : null,
        currency: 'XOF',
        priceAdjustment: priceAdjustment,
        
        images: uploadedImageUrls,
        mainImage: uploadedImageUrls[0],
        imageUrl: uploadedImageUrls[0],
        
        categoryId: await getCategoryId(form.category),
        categoryName: form.category,
        
        companyId: selectedCompany.id,
        companyName: selectedCompany.name,
        supplier: selectedCompany.name,

        // 🔴 IDENTITÉ VENDEUR (CRITIQUE POUR CHAT / CONVERSATIONS)
        sellerId: selectedCompany.id,
        creatorCompanyId: selectedCompany.id,
        ownerCompanyId: selectedCompany.id,
        
        companyData: {
          id: selectedCompany.id,
          name: selectedCompany.name,
          isPremium: selectedCompany.isPremium || false,
          logo: selectedCompany.logo || null
        },

        // ✅ NOUVEAU CHAMP POUR LA LIVRAISON GRATUITE
        hasFreeShipping: hasFreeShipping,
        freeShippingBadge: hasFreeShipping ? 'Livraison gratuite' : null,

        isActive: form.isActive,
        status: 'published',
        inStock: true,
        isVerified: userRole === 'admin',
        
        featured: form.featured,
        trending: form.trending,
        specialOffer: form.specialOffer,
        newArrival: form.newArrival,
        industrial: form.industrial,
        premiumSupplier: selectedCompany.isPremium || form.premiumSupplier,

        stockQuantity: Number(form.stock) || 10000,
        minOrder: Number(form.minOrder) || 1,
        shippingCost: 0,
        deliveryTime: form.deliveryTime,
        rating: 0,
        reviewCount: 0,
        soldCount: 0,

        slug: generateSlug(form.title.trim()),
        updatedAt: new Date(),

        specifications: {
          modelNumber: form.sku.trim() || `MODEL-${Date.now()}`,
          weight: form.weight.trim() || '',
          dimensions: form.dimensions.trim() || '',
        },

        // Données de personnalisation
        personalization: {
          enabled: hasPersonalization,
          fields: personalizationFields
            .filter(field => field.enabled)
            .map(field => ({
              id: field.id,
              label: field.label,
              type: field.type,
              required: field.required,
            })),
          createdAt: new Date(),
          updatedAt: new Date(),
        },

        hasVariants: true,
        variantCount: variantCount,
        variantAttributes: variantAttributes,
        variants: variantsWithImages
      };

      if (isEditMode) {
        await updateDoc(doc(db, 'products', productId), productData);
        
        await addDoc(collection(db, 'product_updates'), {
          productId: productId,
          updateType: 'update',
          updatedAt: new Date(),
          updatedBy: user.uid
        });

        clearInterval(progressInterval);
        
        Alert.alert(
          '✅ Succès',
          `Produit modifié avec succès !\n${variantCount} variante(s) • Prix: ${finalPrice.toLocaleString()} F CFA`,
          [
            {
              text: 'OK',
              onPress: () => router.back()
            }
          ]
        );

      } else {
        const docRef = await addDoc(collection(db, 'products'), {
          ...productData,
          id: '',
          createdAt: new Date(),
          creatorId: user.uid,
          createdBy: userRole === 'admin' ? 'admin' : 'company'
        });
        
        await updateDoc(docRef, { id: docRef.id });
        
        await addDoc(collection(db, 'product_updates'), {
          productId: docRef.id,
          updateType: 'create',
          updatedAt: new Date(),
          updatedBy: user.uid
        });

        clearInterval(progressInterval);
        
        Alert.alert(
          '✅ Succès',
          `Produit créé avec ${variantCount} variantes !\nPrix: ${finalPrice.toLocaleString()} F CFA${priceAdjustment > 0 ? ` (+${priceAdjustment} F ajustement)` : ''}`,
          [
            {
              text: 'Voir les produits',
              onPress: () => router.back()
            },
            {
              text: 'Créer un autre',
              onPress: resetForm
            }
          ]
        );
      }

    } catch (error: any) {
      console.log(`🔥🔥🔥 ERREUR ${isEditMode ? 'MODIFICATION' : 'CRÉATION'} 🔥🔥🔥`);
      console.log('🔥 Type:', typeof error);
      console.log('🔥 Code:', error?.code);
      console.log('🔥 Message:', error?.message);
      
      Alert.alert(
        `Erreur ${isEditMode ? 'de modification' : 'de création'}`,
        `Code: ${error?.code || 'N/A'}\nMessage: ${error?.message || 'Erreur inconnue'}`,
        [{ text: 'OK' }]
      );
      
    } finally {
      setLoading(false);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // FONCTION CATÉGORIE - VÉRIFICATION ET CRÉATION
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
    setVariantColors([]);
    setVariantSizes([]);
    setPriceAdjustment(0);
    setSelectedCompany(null);
    setShowCategoryDropdown(false);
    setShowCompanyDropdown(false);
    setCategorySearch('');
    setHasPersonalization(false);
    setHasFreeShipping(false);
    setPersonalizationFields([
      { id: 'name', label: 'Nom complet', type: 'text', required: true, enabled: true },
      { id: 'email', label: 'Email', type: 'email', required: true, enabled: true },
      { id: 'phone', label: 'Téléphone', type: 'tel', required: false, enabled: true },
      { id: 'message', label: 'Message personnalisé', type: 'textarea', required: false, enabled: true },
      { id: 'date', label: 'Date souhaitée', type: 'date', required: false, enabled: false },
      { id: 'color', label: 'Couleur préférée', type: 'text', required: false, enabled: false },
    ]);
  };

  // COMPOSANT TOGGLE
  const SectionToggle = ({ label, value, onValueChange, description }: any) => (
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

  // COMPOSANT BADGE
  const Badge = ({ text, onRemove, type = 'default' }: any) => (
    <View style={[
      styles.badge,
      type === 'color' && styles.colorBadge,
      type === 'size' && styles.sizeBadge
    ]}>
      <Text style={styles.badgeText}>{text}</Text>
      <TouchableOpacity onPress={() => onRemove(text)}>
        <Ionicons name="close-circle" size={16} color="#FF4444" />
      </TouchableOpacity>
    </View>
  );

  // COMPOSANT MODAL D'AJOUT DE CHAMP PERSONNALISÉ
  const PersonalizationModal = () => (
    <Modal
      visible={showPersonalizationModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowPersonalizationModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Ajouter un champ personnalisé</Text>
            <TouchableOpacity onPress={() => setShowPersonalizationModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nom du champ</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Date de livraison souhaitée"
                value={newFieldLabel}
                onChangeText={setNewFieldLabel}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Type de champ</Text>
              <View style={styles.fieldTypeContainer}>
                {['text', 'textarea', 'email', 'tel', 'date'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.fieldTypeButton,
                      newFieldType === type && styles.fieldTypeButtonActive
                    ]}
                    onPress={() => setNewFieldType(type)}
                  >
                    <Text style={[
                      styles.fieldTypeText,
                      newFieldType === type && styles.fieldTypeTextActive
                    ]}>
                      {type === 'text' ? 'Texte' :
                       type === 'textarea' ? 'Zone de texte' :
                       type === 'email' ? 'Email' :
                       type === 'tel' ? 'Téléphone' :
                       'Date'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalAddButton}
              onPress={addCustomField}
            >
              <Ionicons name="add-circle" size={20} color="#FFF" />
              <Text style={styles.modalAddButtonText}>Ajouter le champ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={styles.loadingText}>Chargement du produit...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditMode ? 'Modifier le produit' : 'Nouveau Produit'}
        </Text>
        <TouchableOpacity onPress={handleSubmit} disabled={loading}>
          <Text style={[styles.publishButton, loading && styles.publishButtonDisabled]}>
            {loading ? '...' : isEditMode ? 'Mettre à jour' : 'Créer'}
          </Text>
        </TouchableOpacity>
      </View>

      {(loading || isUploading) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={styles.loadingText}>
            {isUploading 
              ? `Upload des images... ${uploadProgress}%` 
              : isEditMode ? 'Mise à jour...' : 'Création...'
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

          {images.length > 0 && (
            <View style={styles.photoGrid}>
              {images.map((image, index) => (
                <View key={`${image}-${index}`} style={styles.photoItem}>
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

        {/* SECTION ENTREPRISE */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🏢 Entreprise / Boutique</Text>
            <Text style={styles.requiredLabel}>(Obligatoire)</Text>
          </View>
          
          <Text style={styles.sectionSubtitle}>
            À qui appartient ce produit ? {selectedCompany && `(${selectedCompany.name})`}
          </Text>
          
          <TouchableOpacity 
            style={styles.picker} 
            onPress={() => setShowCompanyDropdown(!showCompanyDropdown)}
          >
            <Text style={selectedCompany ? styles.pickerTextSelected : styles.pickerText}>
              {selectedCompany ? selectedCompany.name : 'Sélectionner une entreprise'}
            </Text>
            <Ionicons name="business" size={20} color="#FF6B00" />
          </TouchableOpacity>

          {showCompanyDropdown && (
            <View style={styles.dropdown}>
              <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                {companies.map((comp) => (
                  <TouchableOpacity 
                    key={comp.id} 
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSelectedCompany(comp);
                      setShowCompanyDropdown(false);
                    }}
                  >
                    <View style={styles.companyItem}>
                      <View style={styles.companyInfo}>
                        <Text style={styles.dropdownText}>{comp.name}</Text>
                        <Text style={styles.companyDetails}>
                          {comp.type || 'Non spécifié'} • {comp.location || 'Localisation non spécifiée'}
                        </Text>
                      </View>
                      {comp.isPremium && <Ionicons name="star" size={14} color="#FFD700" />}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
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
              placeholder="Ex: Chaussures de sport"
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
                Prix normal (F CFA) <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="18900"
                keyboardType="numeric"
                value={form.price}
                onChangeText={(text) => setForm({...form, price: text})}
              />
              {form.price && (
                <View style={styles.priceSummary}>
                  <Text style={styles.priceSummaryText}>
                    Prix normal: <Text style={styles.priceValue}>{basePrice.toLocaleString()} F CFA</Text>
                  </Text>
                  {priceAdjustment > 0 && (
                    <Text style={styles.priceSummaryText}>
                      + Ajustement: <Text style={styles.adjustmentValue}>+{priceAdjustment} F</Text>
                    </Text>
                  )}
                  <Text style={styles.finalPriceText}>
                    Prix final: <Text style={styles.finalPriceValue}>{finalPrice.toLocaleString()} F CFA</Text>
                  </Text>
                </View>
              )}
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

          {/* AJUSTEMENT DE PRIX RAPIDE */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Ajustement rapide (optionnel)</Text>
            <Text style={styles.optionalDescription}>
              Ajouter un montant fixe au prix normal
            </Text>
            <View style={styles.priceToggleContainer}>
              <TouchableOpacity
                style={[
                  styles.priceToggle,
                  priceAdjustment === 500 && styles.priceToggleActive
                ]}
                onPress={() => setPriceAdjustment(priceAdjustment === 500 ? 0 : 500)}
              >
                <View style={styles.priceToggleContent}>
                  <Ionicons 
                    name={priceAdjustment === 500 ? "checkmark-circle" : "add-circle-outline"} 
                    size={16} 
                    color={priceAdjustment === 500 ? "#FFF" : "#666"} 
                  />
                  <Text style={[
                    styles.priceToggleText,
                    priceAdjustment === 500 && styles.priceToggleTextActive
                  ]}>
                    +500 F
                  </Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.priceToggle,
                  priceAdjustment === 1000 && styles.priceToggleActive
                ]}
                onPress={() => setPriceAdjustment(priceAdjustment === 1000 ? 0 : 1000)}
              >
                <View style={styles.priceToggleContent}>
                  <Ionicons 
                    name={priceAdjustment === 1000 ? "checkmark-circle" : "add-circle-outline"} 
                    size={16} 
                    color={priceAdjustment === 1000 ? "#FFF" : "#666"} 
                  />
                  <Text style={[
                    styles.priceToggleText,
                    priceAdjustment === 1000 && styles.priceToggleTextActive
                  ]}>
                    +1000 F
                  </Text>
                </View>
              </TouchableOpacity>
              
              {priceAdjustment > 0 && (
                <TouchableOpacity
                  style={styles.priceToggleRemove}
                  onPress={() => setPriceAdjustment(0)}
                >
                  <View style={styles.priceToggleContent}>
                    <Ionicons name="close-circle" size={16} color="#FF4444" />
                    <Text style={styles.priceToggleRemoveText}>
                      Retirer
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* SECTION CATÉGORIE DYNAMIQUE AVEC RECHERCHE ET AJOUT À LA VOLÉE */}
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
              <View style={styles.categoryDropdown}>
                {/* Champ de recherche */}
                <View style={styles.searchContainer}>
                  <Ionicons name="search" size={16} color="#999" style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Rechercher une catégorie..."
                    placeholderTextColor="#999"
                    value={categorySearch}
                    onChangeText={setCategorySearch}
                  />
                  {categorySearch.length > 0 && (
                    <TouchableOpacity onPress={() => setCategorySearch('')}>
                      <Ionicons name="close-circle" size={16} color="#999" />
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                  {/* Liste des catégories existantes */}
                  {filteredCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setForm({...form, category: cat.name});
                        setShowCategoryDropdown(false);
                        setCategorySearch('');
                      }}
                    >
                      <Text style={styles.dropdownText}>{cat.name}</Text>
                    </TouchableOpacity>
                  ))}

                  {/* Bouton d'ajout de nouvelle catégorie */}
                  {categorySearch.trim() !== '' && 
                   !filteredCategories.some(cat => 
                     cat.name.toLowerCase() === categorySearch.toLowerCase()
                   ) && (
                    <TouchableOpacity
                      style={styles.addNewCategoryButton}
                      onPress={() => {
                        setForm({...form, category: categorySearch.trim()});
                        setShowCategoryDropdown(false);
                        setCategorySearch('');
                      }}
                    >
                      <View style={styles.addNewCategoryContent}>
                        <Ionicons name="add-circle" size={20} color="#FF6B00" />
                        <Text style={styles.addNewCategoryText}>
                          + Ajouter "{categorySearch.trim()}"
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Message si aucune catégorie */}
                  {filteredCategories.length === 0 && categorySearch.trim() === '' && (
                    <View style={styles.emptyCategories}>
                      <Text style={styles.emptyCategoriesText}>
                        Aucune catégorie trouvée
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            )}
          </View>
        </View>

        {/* SECTION COULEURS ET TAILLES */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎨 Couleurs et Tailles</Text>
          <Text style={styles.sectionSubtitle}>
            {variantCount > 0 
              ? `✅ ${variantCount} variantes vont être créées`
              : 'Ajoutez des couleurs et tailles pour générer des variantes'
            }
          </Text>

          {/* COULEURS */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Couleurs <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.addInputContainer}>
              <TextInput
                style={[styles.input, styles.addInput]}
                placeholder="Ex: Noir, Rouge, Bleu"
                value={newColor}
                onChangeText={setNewColor}
                onSubmitEditing={addColor}
              />
              <TouchableOpacity style={styles.addButton} onPress={addColor}>
                <Ionicons name="add" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
            
            {variantColors.length > 0 && (
              <View style={styles.badgesContainer}>
                {variantColors.map((color, index) => (
                  <Badge 
                    key={`color-${color}-${index}`} 
                    text={color} 
                    onRemove={removeColor}
                    type="color"
                  />
                ))}
              </View>
            )}
          </View>

          {/* TAILLES */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Tailles/Pointures <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.addInputContainer}>
              <TextInput
                style={[styles.input, styles.addInput]}
                placeholder="Ex: S, M, L, XL ou 39, 40, 41"
                value={newSize}
                onChangeText={setNewSize}
                onSubmitEditing={addSize}
              />
              <TouchableOpacity style={styles.addButton} onPress={addSize}>
                <Ionicons name="add" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
            
            {variantSizes.length > 0 && (
              <View style={styles.badgesContainer}>
                {variantSizes.map((size, index) => (
                  <Badge 
                    key={`size-${size}-${index}`} 
                    text={size} 
                    onRemove={removeSize}
                    type="size"
                  />
                ))}
              </View>
            )}
          </View>

          {variantCount > 0 && (
            <View style={styles.variantsPreview}>
              <Text style={styles.variantsPreviewTitle}>
                ⚙️ Configuration des variantes
              </Text>
              <Text style={styles.variantsPreviewText}>
                {variantColors.length} couleur(s) × {variantSizes.length} taille(s) = {variantCount} variante(s)
              </Text>
              <Text style={styles.variantsPreviewDetail}>
                Prix par variante: {finalPrice.toLocaleString()} F CFA
                {priceAdjustment > 0 && ` (${basePrice.toLocaleString()} F + ${priceAdjustment} F)`}
              </Text>
            </View>
          )}

          {/* SECTION PERSONNALISATION */}
          <View style={styles.personalizationDivider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>PERSONNALISATION CLIENT</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.personalizationHeader}>
            <View style={styles.personalizationTitleContainer}>
              <Ionicons name="create-outline" size={24} color="#FF6B00" />
              <Text style={styles.personalizationTitle}>Formulaire de personnalisation</Text>
            </View>
            <Switch
              value={hasPersonalization}
              onValueChange={setHasPersonalization}
              trackColor={{ false: '#E0E0E0', true: '#FF6B00' }}
            />
          </View>

          {hasPersonalization && (
            <View style={styles.personalizationContainer}>
              <Text style={styles.personalizationSubtitle}>
                Configurez les champs que le client devra remplir avant d'acheter
              </Text>

              {/* Liste des champs */}
              <View style={styles.fieldsContainer}>
                {personalizationFields.map((field) => (
                  <View key={field.id} style={styles.fieldItem}>
                    <View style={styles.fieldHeader}>
                      <View style={styles.fieldTitleContainer}>
                        <Ionicons 
                          name={field.enabled ? "checkbox-outline" : "close-circle-outline"} 
                          size={20} 
                          color={field.enabled ? "#4CAF50" : "#999"} 
                        />
                        <Text style={[
                          styles.fieldLabel,
                          !field.enabled && styles.fieldLabelDisabled
                        ]}>
                          {field.label}
                        </Text>
                        {field.required && (
                          <Text style={styles.requiredStar}>*</Text>
                        )}
                      </View>
                      <View style={styles.fieldActions}>
                        <TouchableOpacity
                          onPress={() => togglePersonalizationField(field.id)}
                          style={styles.fieldActionButton}
                        >
                          <Ionicons 
                            name={field.enabled ? "eye-outline" : "eye-off-outline"} 
                            size={18} 
                            color={field.enabled ? "#4CAF50" : "#999"} 
                          />
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          onPress={() => updateFieldRequired(field.id)}
                          style={styles.fieldActionButton}
                        >
                          <Ionicons 
                            name={field.required ? "star" : "star-outline"} 
                            size={18} 
                            color={field.required ? "#FF6B00" : "#999"} 
                          />
                        </TouchableOpacity>

                        {field.id.startsWith('custom_') && (
                          <TouchableOpacity
                            onPress={() => removeCustomField(field.id)}
                            style={styles.fieldActionButton}
                          >
                            <Ionicons name="trash-outline" size={18} color="#FF4444" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    
                    {!field.id.startsWith('custom_') && (
                      <TextInput
                        style={styles.fieldEditInput}
                        value={field.label}
                        onChangeText={(text) => updateFieldLabel(field.id, text)}
                        placeholder="Modifier le libellé"
                      />
                    )}
                    
                    <Text style={styles.fieldType}>
                      Type: {field.type === 'text' ? 'Texte' :
                             field.type === 'textarea' ? 'Zone de texte' :
                             field.type === 'email' ? 'Email' :
                             field.type === 'tel' ? 'Téléphone' :
                             'Date'}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Bouton ajouter champ personnalisé */}
              <TouchableOpacity
                style={styles.addFieldButton}
                onPress={() => setShowPersonalizationModal(true)}
              >
                <Ionicons name="add-circle-outline" size={20} color="#FF6B00" />
                <Text style={styles.addFieldButtonText}>Ajouter un champ personnalisé</Text>
              </TouchableOpacity>

              {/* Aperçu pour le client */}
              <View style={styles.previewContainer}>
                <Text style={styles.previewTitle}>👁️ Aperçu client</Text>
                <View style={styles.previewContent}>
                  <Text style={styles.previewText}>
                    {personalizationFields.filter(f => f.enabled).length > 0 
                      ? `Le client devra remplir ${personalizationFields.filter(f => f.enabled).length} champ(s) :`
                      : 'Aucun champ activé pour le moment'}
                  </Text>
                  {personalizationFields.filter(f => f.enabled).map((field, index) => (
                    <View key={field.id} style={styles.previewField}>
                      <Text style={styles.previewFieldLabel}>
                        {field.label}{field.required && ' *'}
                      </Text>
                      <View style={styles.previewFieldInput}>
                        <Text style={styles.previewFieldPlaceholder}>
                          {field.type === 'textarea' ? 'Zone de texte...' : 
                           field.type === 'date' ? 'Sélectionner une date' :
                           `Saisir ${field.label.toLowerCase()}`}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}
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
              <Text style={styles.label}>Stock par variante</Text>
              <TextInput
                style={styles.input}
                placeholder="10"
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
            <Text style={styles.label}>Référence SKU (base)</Text>
            <TextInput
              style={styles.input}
              placeholder="CHAU-SPORT-001"
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

          {/* SECTION LIVRAISON GRATUITE */}
          <View style={[
            styles.shippingFreeSection,
            hasFreeShipping && styles.shippingFreeSectionActive
          ]}>
            <View style={styles.shippingFreeHeader}>
              <View style={styles.shippingFreeTitleContainer}>
                <Ionicons 
                  name={hasFreeShipping ? "gift" : "gift-outline"} 
                  size={24} 
                  color={hasFreeShipping ? "#10b981" : "#999"} 
                />
                <Text style={styles.shippingFreeTitle}>
                  Livraison gratuite
                </Text>
              </View>
              <Switch
                value={hasFreeShipping}
                onValueChange={setHasFreeShipping}
                trackColor={{ false: '#E0E0E0', true: '#10b981' }}
                thumbColor={hasFreeShipping ? '#FFF' : '#f4f3f4'}
              />
            </View>
            
            <Text style={styles.shippingFreeDescription}>
              {hasFreeShipping 
                ? "✓ Ce produit bénéficie de la livraison gratuite pour le client" 
                : "Activez pour offrir la livraison gratuite sur ce produit"}
            </Text>
            
            {hasFreeShipping && (
              <View style={styles.freeShippingBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                <Text style={styles.freeShippingBadgeText}>
                  Livraison OFFERTE - Visible sur la fiche produit
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* RÉSUMÉ FINAL */}
        <View style={[styles.section, styles.summarySection]}>
          <Text style={styles.summaryTitle}>📊 Récapitulatif</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Produit:</Text>
            <Text style={styles.summaryValue}>{form.title || 'Non défini'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Entreprise:</Text>
            <Text style={styles.summaryValue}>{selectedCompany?.name || 'Non sélectionnée'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Catégorie:</Text>
            <Text style={styles.summaryValue}>{form.category || 'Non sélectionnée'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Variantes:</Text>
            <Text style={styles.summaryValue}>{variantCount} combinaisons</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Personnalisation:</Text>
            <Text style={styles.summaryValue}>
              {hasPersonalization 
                ? `${personalizationFields.filter(f => f.enabled).length} champ(s)` 
                : 'Désactivée'}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Livraison gratuite:</Text>
            <Text style={[styles.summaryValue, hasFreeShipping && styles.freeShippingValue]}>
              {hasFreeShipping ? '✅ Oui' : '❌ Non'}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Prix normal:</Text>
            <Text style={styles.summaryValue}>
              {basePrice.toLocaleString()} F CFA
            </Text>
          </View>
          {priceAdjustment > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Ajustement:</Text>
              <Text style={[styles.summaryValue, styles.adjustmentValue]}>
                +{priceAdjustment} F CFA
              </Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Prix final:</Text>
            <Text style={[styles.summaryValue, styles.finalPriceValue]}>
              {finalPrice.toLocaleString()} F CFA
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Stock total:</Text>
            <Text style={styles.summaryValue}>
              {(Number(form.stock) * variantCount).toLocaleString()} unités
            </Text>
          </View>
        </View>

        {/* Bouton de création/mise à jour */}
        <TouchableOpacity 
          style={[styles.submitButton, (loading || isUploading || variantCount === 0) && styles.submitButtonDisabled]} 
          onPress={handleSubmit}
          disabled={loading || isUploading || variantCount === 0}
        >
          {(loading || isUploading) ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name={isEditMode ? "create-outline" : "add-circle-outline"} size={20} color="#FFF" />
              <Text style={styles.submitButtonText}>
                {isEditMode 
                  ? `Mettre à jour ${variantCount} variante${variantCount > 1 ? 's' : ''}`
                  : `Créer ${variantCount} variante${variantCount > 1 ? 's' : ''}`
                }
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.spacer} />
      </ScrollView>

      {/* Modal d'ajout de champ personnalisé */}
      <PersonalizationModal />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FFF' 
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  optionalDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
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
  categoryDropdown: {
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
    maxHeight: 250,
  },
  dropdownScroll: { 
    maxHeight: 200 
  },
  dropdownItem: { 
    padding: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F0F0F0' 
  },
  companyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  companyInfo: {
    flex: 1,
  },
  dropdownText: { 
    fontSize: 16, 
    color: '#333',
    fontWeight: '500',
  },
  companyDetails: { 
    fontSize: 10, 
    color: '#999',
    marginTop: 2,
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
  addInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addInput: {
    flex: 1,
    marginRight: 8,
  },
  addButton: {
    backgroundColor: '#FF6B00',
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    width: 44,
    height: 44,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  colorBadge: {
    backgroundColor: '#E3F2FD',
  },
  sizeBadge: {
    backgroundColor: '#F3E5F5',
  },
  badgeText: {
    fontSize: 14,
    color: '#333',
  },
  priceToggleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  priceToggle: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFF',
    minWidth: 100,
  },
  priceToggleActive: {
    backgroundColor: '#FF6B00',
    borderColor: '#FF6B00',
  },
  priceToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  priceToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  priceToggleTextActive: {
    color: '#FFF',
  },
  priceToggleRemove: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF4444',
    backgroundColor: '#FFF',
    minWidth: 80,
  },
  priceToggleRemoveText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FF4444',
  },
  priceSummary: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B00',
  },
  priceSummaryText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  priceValue: {
    fontWeight: '600',
    color: '#333',
  },
  adjustmentValue: {
    fontWeight: '600',
    color: '#FF6B00',
  },
  finalPriceText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  finalPriceValue: {
    color: '#FF6B00',
    fontSize: 14,
  },
  variantsPreview: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  variantsPreviewTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  variantsPreviewText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  variantsPreviewDetail: {
    fontSize: 12,
    color: '#FF6B00',
    fontWeight: '600',
  },
  summarySection: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  // STYLES POUR LA RECHERCHE DE CATÉGORIES
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#FFF',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    padding: 8,
  },
  addNewCategoryButton: {
    padding: 12,
    backgroundColor: '#FFF7E6',
    borderTopWidth: 1,
    borderTopColor: '#FFE0B2',
  },
  addNewCategoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addNewCategoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FF6B00',
  },
  emptyCategories: {
    padding: 20,
    alignItems: 'center',
  },
  emptyCategoriesText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  // STYLES POUR LA PERSONNALISATION
  personalizationDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
  },
  personalizationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  personalizationTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  personalizationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  personalizationContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  personalizationSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  fieldsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  fieldItem: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  fieldLabelDisabled: {
    color: '#999',
    textDecorationLine: 'line-through',
  },
  requiredStar: {
    color: '#FF4444',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  fieldActions: {
    flexDirection: 'row',
    gap: 8,
  },
  fieldActionButton: {
    padding: 4,
  },
  fieldEditInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    marginBottom: 6,
    backgroundColor: '#FFF',
  },
  fieldType: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  addFieldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FF6B00',
    borderStyle: 'dashed',
    borderRadius: 8,
    marginBottom: 16,
  },
  addFieldButtonText: {
    fontSize: 14,
    color: '#FF6B00',
    fontWeight: '500',
  },
  previewContainer: {
    backgroundColor: '#E8F4FD',
    borderRadius: 8,
    padding: 12,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  previewContent: {
    gap: 8,
  },
  previewText: {
    fontSize: 13,
    color: '#666',
  },
  previewField: {
    marginBottom: 8,
  },
  previewFieldLabel: {
    fontSize: 12,
    color: '#333',
    marginBottom: 2,
    fontWeight: '500',
  },
  previewFieldInput: {
    backgroundColor: '#FFF',
    borderRadius: 4,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  previewFieldPlaceholder: {
    fontSize: 12,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    gap: 16,
  },
  fieldTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fieldTypeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  fieldTypeButtonActive: {
    backgroundColor: '#FF6B00',
    borderColor: '#FF6B00',
  },
  fieldTypeText: {
    fontSize: 12,
    color: '#666',
  },
  fieldTypeTextActive: {
    color: '#FFF',
  },
  modalAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF6B00',
    padding: 14,
    borderRadius: 8,
    marginTop: 8,
  },
  modalAddButtonText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
  // NOUVEAUX STYLES POUR LA LIVRAISON GRATUITE
  shippingFreeSection: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  shippingFreeSectionActive: {
    borderColor: '#10b981',
    backgroundColor: '#F0FDF4',
  },
  shippingFreeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  shippingFreeTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shippingFreeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  shippingFreeDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    lineHeight: 18,
  },
  freeShippingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  freeShippingBadgeText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
  },
  freeShippingValue: {
    color: '#10b981',
    fontWeight: 'bold',
  },
});