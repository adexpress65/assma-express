// app/suppliers/register.tsx - VERSION CORRIGÉE
import { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert,
  Image, Platform, ActivityIndicator, Dimensions, Modal, SafeAreaView
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';

// FIREBASE SERVICES
import { auth, db, storage } from '../../src/config/firebase';
import { createUserWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { doc, setDoc, collection, getDocs, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// EXPO & UI
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';

interface Category {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  productCount: number;
}

interface SupplierForm {
  // Informations de base
  name: string;
  email: string;
  password: string;
  phone: string;
  
  // Localisation
  location: string;
  address: string;
  city: string;
  country: string;
  
  // Description entreprise
  description: string;
  businessType: string;
  mainProducts: string;
  type: string;
  
  // Statistiques entreprise
  employees: string;
  annualRevenue: string;
  yearsEstablished: string;
  
  // Certifications
  certifications: string;
  
  // Images
  logo: string;
  coverImage: string;
  
  // Catégories
  categories: string[];
  mainCategory: string;
  selectedCategories: string[];
}

// Obtenir la largeur de l'écran
const { width: screenWidth } = Dimensions.get('window');

// Fonction pour obtenir l'icône selon la catégorie
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

export default function SupplierRegistration() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isEditMode = !!id;
  
  const [form, setForm] = useState<SupplierForm>({
    name: '',
    email: '',
    password: '',
    phone: '',
    location: '',
    address: '',
    city: '',
    country: '',
    description: '',
    businessType: '',
    mainProducts: '',
    type: '',
    employees: '',
    annualRevenue: '',
    yearsEstablished: '',
    certifications: '',
    logo: '',
    coverImage: '',
    categories: [],
    mainCategory: '',
    selectedCategories: [],
  });
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageType, setImageType] = useState<'logo' | 'cover'>('logo');
  const [showImagePreview, setShowImagePreview] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Charger les données de l'entreprise en mode édition
  useEffect(() => {
    if (isEditMode && id) {
      loadCompanyData();
    }
  }, [id]);

  const loadCompanyData = async () => {
    try {
      console.log(`🔍 Chargement de l'entreprise ${id} pour modification...`);
      const companyDoc = await getDoc(doc(db, 'companies', id));
      
      if (!companyDoc.exists()) {
        Alert.alert('Erreur', 'Entreprise non trouvée');
        router.back();
        return;
      }

      const data = companyDoc.data();
      
      // Formater les catégories sélectionnées
      const selectedCats = data.categories || [];
      const mainCat = data.mainCategory || (selectedCats[0] || '');
      
      // Formater l'adresse
      const addressData = data.address || {};
      
      setForm({
        name: data.name || '',
        email: data.email || '',
        password: '', // Ne pas charger le mot de passe
        phone: data.phone || '',
        location: data.location || '',
        address: addressData.street || '',
        city: addressData.city || '',
        country: addressData.country || '',
        description: data.description || '',
        businessType: data.businessType || '',
        mainProducts: data.mainProducts || '',
        type: data.type || data.businessType || '',
        employees: data.employees || '',
        annualRevenue: data.annualRevenue || '',
        yearsEstablished: data.yearEstablished?.toString() || '',
        certifications: Array.isArray(data.certifications) ? data.certifications.join(', ') : '',
        logo: data.logo || '',
        coverImage: data.coverImage || '',
        categories: selectedCats,
        mainCategory: mainCat,
        selectedCategories: selectedCats,
      });

      console.log('✅ Entreprise chargée avec succès');
      
    } catch (error) {
      console.error('❌ Erreur chargement entreprise:', error);
      Alert.alert('Erreur', 'Impossible de charger les données de l\'entreprise');
    } finally {
      setInitialLoading(false);
    }
  };

  // Demander les permissions
  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Nous avons besoin de la permission pour accéder à vos photos.');
      }
    })();
  }, []);

  // Charger les catégories
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const categoriesRef = collection(db, 'categories');
      const snapshot = await getDocs(categoriesRef);
      
      const categoriesData: Category[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.isActive !== false) {
          categoriesData.push({
            id: doc.id,
            name: data.name,
            description: data.description || '',
            isActive: data.isActive || true,
            productCount: data.productCount || 0
          });
        }
      });
      
      categoriesData.sort((a, b) => a.name.localeCompare(b.name));
      setCategories(categoriesData);
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
      setCategories([
        { id: 'mode', name: 'Mode & Accessoires', description: 'Vêtements, chaussures, accessoires', isActive: true, productCount: 0 },
        { id: 'electronique', name: 'Électronique', description: 'Appareils électroniques et composants', isActive: true, productCount: 0 },
        { id: 'machines', name: 'Machines Industrielles', description: 'Équipements industriels et machines', isActive: true, productCount: 0 },
        { id: 'alimentation', name: 'Alimentation', description: 'Produits alimentaires et boissons', isActive: true, productCount: 0 },
        { id: 'construction', name: 'Construction', description: 'Matériaux et équipements de construction', isActive: true, productCount: 0 },
      ]);
    } finally {
      setLoadingCategories(false);
    }
  };

// Sélectionner et uploader une image
const pickImage = async (type: 'logo' | 'cover') => {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: type === 'logo',
      aspect: type === 'logo' ? [1, 1] : [16, 9],
      quality: 0.7, 
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const localUri = result.assets[0].uri;
      
      console.log(`🚀 Début de l'upload pour ${type}...`);
      // Si tu as un state loading : setUploading(true);

      try {
        // 1. Transformer l'image en BLOB (indispensable pour Firebase Storage)
        const response = await fetch(localUri);
        const blob = await response.blob();

        // 2. Créer le nom de fichier et la référence
        // Syntaxe modulaire : ref(instance_storage, chemin)
        const filename = `company_${Date.now()}_${type}.jpg`;
        const storageRef = ref(storage, `companies/${filename}`);

        // 3. Envoyer le BLOB vers Firebase
        const snapshot = await uploadBytes(storageRef, blob);
        
        // 4. Récupérer l'URL finale HTTPS
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        // 5. Nettoyage de la mémoire du téléphone
        blob.close();

        console.log(`✅ URL récupérée :`, downloadURL);

        // 6. Mise à jour de ton formulaire (State)
        if (type === 'logo') {
          setForm(prev => ({ ...prev, logo: downloadURL }));
        } else {
          // Mise à jour pour la photo de couverture
          if (typeof setSelectedImage === 'function') setSelectedImage(downloadURL); 
          if (typeof setShowImagePreview === 'function') setShowImagePreview(true);
          
          setForm(prev => ({ ...prev, coverImage: downloadURL }));
        }

        Alert.alert('Succès', 'Image téléchargée avec succès !');

      } catch (uploadError: any) {
        console.error("❌ Erreur pendant l'upload:", uploadError);
        Alert.alert('Erreur Firebase', `Le transfert a échoué: ${uploadError.message}`);
      } finally {
        // setUploading(false);
      }
    }
  } catch (error) {
    console.error('❌ Erreur sélection image:', error);
    Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
  }
};

  // Confirmer la sélection de l'image de couverture
  const confirmCoverImage = () => {
    if (selectedImage) {
      setForm(prev => ({ ...prev, coverImage: selectedImage }));
      setShowImagePreview(false);
      setSelectedImage(null);
      
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }, 100);
    }
  };

  // Annuler la sélection de l'image de couverture
  const cancelCoverImage = () => {
    setSelectedImage(null);
    setShowImagePreview(false);
  };

  // Retirer une image
  const removeImage = (type: 'logo' | 'cover') => {
    setForm(prev => ({ ...prev, [type]: '' }));
  };

  const handleSubmit = async () => {
    // Validation
    if (!form.name || !form.email) {
      Alert.alert('Erreur', 'Veuillez remplir les champs obligatoires (Nom, Email)');
      return;
    }

    if (!isEditMode && !form.password) {
      Alert.alert('Erreur', 'Le mot de passe est requis pour créer un compte');
      return;
    }
    
    if (!form.mainCategory) {
      Alert.alert('Erreur', 'Veuillez sélectionner une catégorie principale pour votre entreprise');
      return;
    }

    setLoading(true);
    try {
      let companyId = id || '';
      
      if (isEditMode && id) {
        // ✅ MODIFICATION : Mise à jour de l'entreprise existante
        console.log('🔄 Mise à jour de l\'entreprise:', id);
        
        const updateData = {
          name: form.name,
          email: form.email,
          phone: form.phone,
          location: form.location || `${form.city}, ${form.country}`,
          address: {
            street: form.address,
            city: form.city,
            country: form.country,
          },
          description: form.description,
          businessType: form.businessType,
          mainProducts: form.mainProducts,
          type: form.type || form.businessType,
          employees: form.employees,
          annualRevenue: form.annualRevenue,
          yearEstablished: parseInt(form.yearsEstablished) || new Date().getFullYear(),
          certifications: form.certifications ? form.certifications.split(',').map(c => c.trim()) : [],
          logo: form.logo || 'https://via.placeholder.com/100x100/007AFF/ffffff?text=LOGO',
          coverImage: form.coverImage || 'https://via.placeholder.com/800x200/007AFF/ffffff?text=BANNER',
          categories: form.categories.length > 0 ? form.categories : [form.mainCategory],
          mainCategory: form.mainCategory,
          updatedAt: new Date(),
        };

        await updateDoc(doc(db, 'companies', id), updateData);

        // Mettre à jour aussi le document utilisateur
        await updateDoc(doc(db, 'users', id), {
          displayName: form.name,
          companyName: form.name,
          updatedAt: new Date(),
        });

        // Si l'utilisateur a fourni un nouveau mot de passe
        if (form.password && auth.currentUser) {
          try {
            await updatePassword(auth.currentUser, form.password);
          } catch (error) {
            console.error('Erreur mise à jour mot de passe:', error);
          }
        }

        Alert.alert(
          '✅ Succès',
          'Votre profil fournisseur a été mis à jour avec succès!',
          [{ text: 'OK', onPress: () => router.back() }]
        );

      } else {
        // ✅ CRÉATION : Nouvelle entreprise
        console.log('🆕 Création d\'une nouvelle entreprise');
        
        const userCredential = await createUserWithEmailAndPassword(auth, form.email, form.password);
        const user = userCredential.user;
        companyId = user.uid;

        const companyData = {
          id: user.uid,
          uid: user.uid,
          categories: form.categories.length > 0 ? form.categories : [form.mainCategory],
          mainCategory: form.mainCategory,
          name: form.name,
          email: form.email,
          phone: form.phone,
          location: form.location || `${form.city}, ${form.country}`,
          address: {
            street: form.address,
            city: form.city,
            country: form.country,
          },
          description: form.description,
          businessType: form.businessType,
          mainProducts: form.mainProducts,
          type: form.type || form.businessType,
          employees: form.employees,
          annualRevenue: form.annualRevenue,
          yearsOnPlatform: 0,
          yearEstablished: parseInt(form.yearsEstablished) || new Date().getFullYear(),
          certifications: form.certifications ? form.certifications.split(',').map(c => c.trim()) : [],
          logo: form.logo || 'https://via.placeholder.com/100x100/007AFF/ffffff?text=LOGO',
          coverImage: form.coverImage || 'https://via.placeholder.com/800x200/007AFF/ffffff?text=BANNER',
          rating: 0,
          responseRate: 85,
          responseTime: '24-48 heures',
          totalOrders: 0,
          totalProducts: 0,
          verified: false,
          goldSupplier: false,
          tradeAssurance: false,
          verification: {
            badges: ['new_supplier'],
            status: 'pending',
            verified: false,
          },
          stats: {
            productCount: 0,
            orderCount: 0,
            rating: 0,
            reviewCount: 0,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: false,
        };

        await setDoc(doc(db, 'companies', user.uid), companyData);

        const userData = {
          uid: user.uid,
          email: user.email,
          displayName: form.name,
          userType: 'seller',
          companyId: user.uid,
          companyName: form.name,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        await setDoc(doc(db, 'users', user.uid), userData);

        Alert.alert(
          '✅ Succès',
          'Votre compte fournisseur a été créé avec succès! Notre équipe va vérifier vos informations sous 24h.',
          [{ text: 'OK', onPress: () => router.replace('/suppliers/dashboard') }]
        );
      }
      
    } catch (error: any) {
      console.error('Erreur:', error);
      Alert.alert(
        'Erreur',
        error.message || `Une erreur est survenue lors de ${isEditMode ? 'la mise à jour' : 'l\'inscription'}`
      );
    } finally {
      setLoading(false);
    }
  };

  // MODAL POUR PRÉVISUALISATION DE L'IMAGE DE COUVERTURE
  const ImagePreviewModal = () => (
    <Modal
      visible={showImagePreview}
      animationType="slide"
      transparent={true}
      onRequestClose={cancelCoverImage}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Prévisualisation de la bannière</Text>
            <TouchableOpacity onPress={cancelCoverImage} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.imagePreviewContainer}>
            {selectedImage && (
              <Image 
                source={{ uri: selectedImage }} 
                style={styles.previewImage}
                resizeMode="cover"
              />
            )}
          </View>
          
          <Text style={styles.previewHint}>
            Cette image sera utilisée comme bannière de votre profil
          </Text>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]}
              onPress={cancelCoverImage}
            >
              <Text style={styles.cancelButtonText}>Changer d'image</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.modalButton, styles.confirmButton]}
              onPress={confirmCoverImage}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.confirmButtonText}>Utiliser cette image</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#ff6a00" />
        <Text style={styles.loadingText}>Chargement de votre profil...</Text>
      </SafeAreaView>
    );
  }

  return (
    <ScrollView style={styles.container} ref={scrollViewRef}>
      <Stack.Screen options={{ 
        title: isEditMode ? 'Modifier mon profil' : 'Inscription Fournisseur' 
      }} />
      
      <Text style={styles.title}>
        {isEditMode ? 'Modifier votre profil' : 'Devenir Fournisseur A2Express'}
      </Text>
      <Text style={styles.subtitle}>
        {isEditMode 
          ? 'Mettez à jour les informations de votre entreprise'
          : 'Rejoignez notre plateforme B2B et développez votre business à l\'international'
        }
      </Text>

      <View style={styles.form}>
        
        {/* SECTION IMAGES */}
        <Text style={styles.sectionTitle}>Images de l'entreprise</Text>
        
        {/* Logo */}
        <View style={styles.imageSection}>
          <View style={styles.imageHeader}>
            <Text style={styles.label}>Logo de l'entreprise</Text>
            {form.logo && (
              <TouchableOpacity 
                style={styles.removeButton}
                onPress={() => removeImage('logo')}
              >
                <Ionicons name="trash-outline" size={16} color="#FF4444" />
                <Text style={styles.removeButtonText}>Supprimer</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <TouchableOpacity 
            style={styles.imageUploadContainer}
            onPress={() => pickImage('logo')}
            activeOpacity={0.8}
          >
            {form.logo ? (
              <View style={styles.selectedImageContainer}>
                <Image 
                  source={{ uri: form.logo }} 
                  style={styles.selectedLogo}
                  resizeMode="cover"
                />
                <View style={styles.imageOverlay}>
                  <Ionicons name="camera" size={24} color="#fff" />
                  <Text style={styles.overlayText}>Changer le logo</Text>
                </View>
              </View>
            ) : (
              <View style={styles.uploadPlaceholder}>
                <View style={styles.uploadIconContainer}>
                  <Ionicons name="camera" size={32} color="#007AFF" />
                </View>
                <Text style={styles.uploadText}>Ajouter un logo</Text>
                <Text style={styles.uploadHint}>Format carré • JPG/PNG</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Cover Image */}
        <View style={styles.imageSection}>
          <View style={styles.imageHeader}>
            <Text style={styles.label}>Image de couverture</Text>
            {form.coverImage && (
              <TouchableOpacity 
                style={styles.removeButton}
                onPress={() => removeImage('cover')}
              >
                <Ionicons name="trash-outline" size={16} color="#FF4444" />
                <Text style={styles.removeButtonText}>Supprimer</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <TouchableOpacity 
            style={styles.imageUploadContainer}
            onPress={() => pickImage('cover')}
            activeOpacity={0.8}
          >
            {form.coverImage ? (
              <View style={styles.selectedImageContainer}>
                <Image 
                  source={{ uri: form.coverImage }} 
                  style={styles.selectedCover}
                  resizeMode="cover"
                />
                <View style={styles.imageOverlay}>
                  <Ionicons name="image" size={24} color="#fff" />
                  <Text style={styles.overlayText}>Changer la bannière</Text>
                </View>
              </View>
            ) : (
              <View style={[styles.uploadPlaceholder, styles.coverPlaceholder]}>
                <View style={styles.uploadIconContainer}>
                  <Ionicons name="image" size={32} color="#007AFF" />
                </View>
                <Text style={styles.uploadText}>Ajouter une bannière</Text>
                <Text style={styles.uploadHint}>Format paysage 16:9 recommandé</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* SECTION INFORMATIONS DE BASE */}
        <Text style={styles.sectionTitle}>Informations de base</Text>
        
        <Text style={styles.label}>Nom de l'entreprise *</Text>
        <TextInput
          style={styles.input}
          value={form.name}
          onChangeText={(text) => setForm({...form, name: text})}
          placeholder="Ex: Shenzhen Blackberry E-Commerce Co., Ltd"
        />

        <Text style={styles.label}>Email professionnel *</Text>
        <TextInput
          style={styles.input}
          value={form.email}
          onChangeText={(text) => setForm({...form, email: text})}
          placeholder="contact@votre-entreprise.com"
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!isEditMode} // L'email n'est modifiable qu'à la création
        />

        {isEditMode ? (
          // En mode édition, le mot de passe est optionnel
          <>
            <Text style={styles.label}>Nouveau mot de passe (optionnel)</Text>
            <Text style={styles.hint}>
              Laissez vide pour conserver votre mot de passe actuel
            </Text>
            <TextInput
              style={styles.input}
              value={form.password}
              onChangeText={(text) => setForm({...form, password: text})}
              placeholder="Minimum 6 caractères"
              secureTextEntry
            />
          </>
        ) : (
          // En création, le mot de passe est obligatoire
          <>
            <Text style={styles.label}>Mot de passe *</Text>
            <TextInput
              style={styles.input}
              value={form.password}
              onChangeText={(text) => setForm({...form, password: text})}
              placeholder="Minimum 6 caractères"
              secureTextEntry
            />
          </>
        )}

        <Text style={styles.label}>Téléphone</Text>
        <TextInput
          style={styles.input}
          value={form.phone}
          onChangeText={(text) => setForm({...form, phone: text})}
          placeholder="+33 1 23 45 67 89"
          keyboardType="phone-pad"
        />

        {/* SECTION LOCALISATION */}
        <Text style={styles.sectionTitle}>Localisation</Text>

        <Text style={styles.label}>Adresse complète</Text>
        <TextInput
          style={styles.input}
          value={form.address}
          onChangeText={(text) => setForm({...form, address: text})}
          placeholder="Adresse complète de l'entreprise"
        />

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Ville</Text>
            <TextInput
              style={styles.input}
              value={form.city}
              onChangeText={(text) => setForm({...form, city: text})}
              placeholder="Ville"
            />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Pays</Text>
            <TextInput
              style={styles.input}
              value={form.country}
              onChangeText={(text) => setForm({...form, country: text})}
              placeholder="Pays"
            />
          </View>
        </View>

        <Text style={styles.label}>Localisation complète</Text>
        <TextInput
          style={styles.input}
          value={form.location}
          onChangeText={(text) => setForm({...form, location: text})}
          placeholder="Ex: Shenzhen, Guangdong, China"
        />

        {/* SECTION CATÉGORIES */}
        <Text style={styles.sectionTitle}>Catégories de produits *</Text>
        
        {loadingCategories ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#ff6a00" />
            <Text style={styles.loadingText}>Chargement des catégories...</Text>
          </View>
        ) : (
          <>
            {/* Catégorie principale */}
            <Text style={styles.label}>Catégorie principale *</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
            >
              <View style={styles.categoryGrid}>
                {categories.slice(0, 8).map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryOption,
                      form.mainCategory === category.id && styles.selectedCategory
                    ]}
                    onPress={() => {
                      const newCategories = form.selectedCategories.includes(category.id) 
                        ? form.selectedCategories 
                        : [...form.selectedCategories, category.id];
                      
                      setForm({
                        ...form, 
                        mainCategory: category.id,
                        categories: newCategories,
                        selectedCategories: newCategories
                      });
                    }}
                  >
                    <Ionicons 
                      name={getCategoryIcon(category.name)} 
                      size={20} 
                      color={form.mainCategory === category.id ? '#fff' : '#666'} 
                    />
                    <Text style={[
                      styles.categoryText,
                      form.mainCategory === category.id && styles.selectedCategoryText
                    ]} numberOfLines={1}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Autres catégories */}
            <Text style={styles.label}>Autres catégories (optionnel)</Text>
            <View style={styles.chipContainer}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.chip,
                    form.selectedCategories.includes(category.id) && styles.selectedChip,
                    form.mainCategory === category.id && styles.mainChip
                  ]}
                  onPress={() => {
                    let newSelectedCategories;
                    
                    if (form.selectedCategories.includes(category.id)) {
                      newSelectedCategories = form.selectedCategories.filter(id => id !== category.id);
                      
                      const newMainCategory = form.mainCategory === category.id 
                        ? (newSelectedCategories[0] || '')
                        : form.mainCategory;
                      
                      setForm({
                        ...form,
                        categories: newSelectedCategories,
                        selectedCategories: newSelectedCategories,
                        mainCategory: newMainCategory
                      });
                    } else {
                      newSelectedCategories = [...form.selectedCategories, category.id];
                      setForm({
                        ...form,
                        categories: newSelectedCategories,
                        selectedCategories: newSelectedCategories
                      });
                    }
                  }}
                >
                  <Text style={[
                    styles.chipText,
                    form.selectedCategories.includes(category.id) && styles.selectedChipText,
                    form.mainCategory === category.id && styles.mainChipText
                  ]}>
                    {category.name}
                  </Text>
                  {form.mainCategory === category.id && (
                    <Ionicons name="star" size={10} color="#ffd700" style={styles.starIcon} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={styles.hint}>
              Sélectionnez votre activité principale et les catégories correspondant à vos produits
            </Text>
            
            {form.selectedCategories.length > 0 && (
              <View style={styles.selectedPreview}>
                <Text style={styles.previewTitle}>Catégories sélectionnées :</Text>
                <View style={styles.previewChips}>
                  {form.selectedCategories.map(categoryId => {
                    const category = categories.find(c => c.id === categoryId);
                    return category ? (
                      <View key={categoryId} style={styles.previewChip}>
                        <Text style={styles.previewChipText}>{category.name}</Text>
                        {form.mainCategory === categoryId && (
                          <Text style={styles.mainIndicator}> (Principal)</Text>
                        )}
                      </View>
                    ) : null;
                  })}
                </View>
              </View>
            )}
          </>
        )}

        {/* SECTION DESCRIPTION ENTREPRISE */}
        <Text style={styles.sectionTitle}>Description de l'entreprise</Text>

        <Text style={styles.label}>Description détaillée</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={form.description}
          onChangeText={(text) => setForm({...form, description: text})}
          placeholder="Décrivez votre entreprise, votre expertise, vos valeurs..."
          multiline
          numberOfLines={4}
        />

        <Text style={styles.label}>Type d'entreprise</Text>
        <TextInput
          style={styles.input}
          value={form.businessType}
          onChangeText={(text) => setForm({...form, businessType: text})}
          placeholder="Ex: Fabricant, Trading Company"
        />

        <Text style={styles.label}>Produits principaux</Text>
        <TextInput
          style={styles.input}
          value={form.mainProducts}
          onChangeText={(text) => setForm({...form, mainProducts: text})}
          placeholder="Ex: Cadenas Sécurité, Serrures Digitales, Antivols"
        />

        <Text style={styles.label}>Type de business</Text>
        <TextInput
          style={styles.input}
          value={form.type}
          onChangeText={(text) => setForm({...form, type: text})}
          placeholder="Ex: Manufacturer, Trading Company"
        />

        {/* SECTION STATISTIQUES */}
        <Text style={styles.sectionTitle}>Statistiques de l'entreprise</Text>

        <Text style={styles.label}>Nombre d'employés</Text>
        <TextInput
          style={styles.input}
          value={form.employees}
          onChangeText={(text) => setForm({...form, employees: text})}
          placeholder="Ex: 50-100 personnes"
        />

        <Text style={styles.label}>Chiffre d'affaires annuel</Text>
        <TextInput
          style={styles.input}
          value={form.annualRevenue}
          onChangeText={(text) => setForm({...form, annualRevenue: text})}
          placeholder="Ex: US$10-50 Million"
        />

        <Text style={styles.label}>Année de création</Text>
        <TextInput
          style={styles.input}
          value={form.yearsEstablished}
          onChangeText={(text) => setForm({...form, yearsEstablished: text})}
          placeholder="Ex: 2010"
          keyboardType="numeric"
        />

        {/* SECTION CERTIFICATIONS */}
        <Text style={styles.sectionTitle}>Certifications</Text>

        <Text style={styles.label}>Certifications (séparées par des virgules)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={form.certifications}
          onChangeText={(text) => setForm({...form, certifications: text})}
          placeholder="Ex: ISO 9001, CE, ROHS, UL, BSCI"
          multiline
          numberOfLines={3}
        />

        {/* BOUTON D'INSCRIPTION / MISE À JOUR */}
        <TouchableOpacity 
          style={[styles.button, (loading || loadingCategories) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading || loadingCategories}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>
              {loadingCategories 
                ? 'Chargement...' 
                : isEditMode 
                  ? 'Mettre à jour mon profil' 
                  : 'Créer mon compte fournisseur'
              }
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* MODAL DE PRÉVISUALISATION */}
      <ImagePreviewModal />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 8,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  form: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 20,
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#ff6a00',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  
  // STYLES POUR LES IMAGES
  imageSection: {
    marginBottom: 24,
  },
  imageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#FFF0F0',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFDDDD',
  },
  removeButtonText: {
    fontSize: 12,
    color: '#FF4444',
    marginLeft: 4,
    fontWeight: '500',
  },
  imageUploadContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
  },
  selectedImageContainer: {
    width: '100%',
    height: 120,
    position: 'relative',
  },
  selectedLogo: {
    width: '100%',
    height: '100%',
  },
  selectedCover: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  uploadPlaceholder: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  coverPlaceholder: {
    height: 100,
  },
  uploadIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  uploadHint: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  
  // MODAL STYLES
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: screenWidth * 0.9,
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  imagePreviewContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#000',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    padding: 16,
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    marginRight: 8,
  },
  confirmButton: {
    backgroundColor: '#007AFF',
    marginLeft: 8,
  },
  cancelButtonText: {
    color: '#495057',
    fontWeight: '600',
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  
  // STYLES POUR LES CATÉGORIES
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
  },
  categoryScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  categoryGrid: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 8,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
  },
  selectedCategory: {
    backgroundColor: '#ff6a00',
    borderColor: '#ff6a00',
  },
  categoryText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    maxWidth: 100,
  },
  selectedCategoryText: {
    color: '#fff',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedChip: {
    backgroundColor: '#ff6a00',
    borderColor: '#ff6a00',
  },
  mainChip: {
    backgroundColor: '#fff8e6',
    borderColor: '#ffa500',
  },
  chipText: {
    fontSize: 12,
    color: '#666',
  },
  selectedChipText: {
    color: '#fff',
  },
  mainChipText: {
    color: '#ff6a00',
    fontWeight: 'bold',
  },
  starIcon: {
    marginLeft: 4,
  },
  hint: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  selectedPreview: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  previewChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  previewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f4ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  previewChipText: {
    fontSize: 11,
    color: '#007AFF',
  },
  mainIndicator: {
    fontSize: 11,
    color: '#ff6a00',
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 40,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
