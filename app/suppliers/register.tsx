// app/suppliers/register.tsx - VERSION COMPLÈTE AVEC CATÉGORIES FIRESTORE
import { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert,
  Image, Platform, ActivityIndicator
} from 'react-native';
import { Stack, router } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../../src/config/firebase';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

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
  
  // Catégories (NOUVEAUX CHAMPS)
  categories: string[];
  mainCategory: string;
  selectedCategories: string[];
}

const BUSINESS_TYPES = [
  'Fabricant',
  'Grossiste',
  'Société de commerce',
  'Détaillant',
  'Prestataire de services',
  'Autre'
];

const EMPLOYEE_RANGES = [
  '1-10 personnes',
  '11-50 personnes',
  '51-100 personnes',
  '101-200 personnes',
  '201-500 personnes',
  '501-1000 personnes',
  '1000+ personnes'
];

const REVENUE_RANGES = [
  'Moins de 1 million USD',
  '1-5 million USD',
  '5-10 million USD',
  '10-50 million USD',
  '50-100 million USD',
  '100-500 million USD',
  '500 million+ USD'
];

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
  
  return 'pricetag'; // icône par défaut
};

export default function SupplierRegistration() {
  const [form, setForm] = useState<SupplierForm>({
    // Informations de base
    name: '',
    email: '',
    password: '',
    phone: '',
    
    // Localisation
    location: '',
    address: '',
    city: '',
    country: '',
    
    // Description entreprise
    description: '',
    businessType: '',
    mainProducts: '',
    type: '',
    
    // Statistiques entreprise
    employees: '',
    annualRevenue: '',
    yearsEstablished: '',
    
    // Certifications
    certifications: '',
    
    // Images
    logo: '',
    coverImage: '',
    
    // Catégories
    categories: [],
    mainCategory: '',
    selectedCategories: [],
  });
  
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Charger les catégories depuis Firestore
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
      
      // Trier par nom
      categoriesData.sort((a, b) => a.name.localeCompare(b.name));
      setCategories(categoriesData);
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
      // Catégories par défaut si Firestore échoue
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

  // Sélectionner une image
  const pickImage = async (type: 'logo' | 'cover') => {
    try {
      setUploadingImage(true);
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'logo' ? [1, 1] : [4, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setForm(prev => ({
          ...prev,
          [type]: result.assets[0].uri
        }));
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRegister = async () => {
    // Validation des champs obligatoires
    if (!form.name || !form.email || !form.password) {
      Alert.alert('Erreur', 'Veuillez remplir les champs obligatoires (Nom, Email, Mot de passe)');
      return;
    }
    
    // Validation catégorie principale
    if (!form.mainCategory) {
      Alert.alert('Erreur', 'Veuillez sélectionner une catégorie principale pour votre entreprise');
      return;
    }

    setLoading(true);
    try {
      // 1. Créer le compte utilisateur
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        form.email, 
        form.password
      );
      const user = userCredential.user;

      // 2. Préparer les données pour Firestore
      const companyData = {
        // Identifiants
        id: user.uid,
        uid: user.uid,
        
        // CATÉGORIES (TRÈS IMPORTANT !)
        categories: form.categories.length > 0 ? form.categories : [form.mainCategory],
        mainCategory: form.mainCategory,
        
        // Informations de base
        name: form.name,
        email: form.email,
        phone: form.phone,
        
        // Localisation
        location: form.location || `${form.city}, ${form.country}`,
        address: {
          street: form.address,
          city: form.city,
          country: form.country,
        },
        
        // Description entreprise
        description: form.description,
        businessType: form.businessType,
        mainProducts: form.mainProducts,
        type: form.type || form.businessType,
        
        // Statistiques entreprise
        employees: form.employees,
        annualRevenue: form.annualRevenue,
        yearsOnPlatform: 0, // Nouveau sur la plateforme
        yearEstablished: parseInt(form.yearsEstablished) || new Date().getFullYear(),
        
        // Certifications
        certifications: form.certifications ? form.certifications.split(',').map(c => c.trim()) : [],
        
        // Images
        logo: form.logo || 'https://via.placeholder.com/100x100/007AFF/ffffff?text=LOGO',
        coverImage: form.coverImage || 'https://via.placeholder.com/800x200/007AFF/ffffff?text=BANNER',
        
        // Statistiques et performance (valeurs par défaut)
        rating: 0,
        responseRate: 85, // Taux de réponse par défaut
        responseTime: '24-48 heures',
        totalOrders: 0,
        totalProducts: 0,
        yearsOnPlatform: 1, // Par défaut 1 an
        
        // Vérification et badges
        verified: false,
        goldSupplier: false,
        tradeAssurance: false,
        verification: {
          badges: ['new_supplier'],
          status: 'pending',
          verified: false,
        },
        
        // Stats pour le dashboard
        stats: {
          productCount: 0,
          orderCount: 0,
          rating: 0,
          reviewCount: 0,
        },
        
        // Métadonnées
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      await setDoc(doc(db, 'companies', user.uid), companyData);

      // 3. Créer aussi un document utilisateur
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
        'Succès', 
        'Votre compte fournisseur a été créé avec succès! Notre équipe va vérifier vos informations sous 24h.'
      );
      router.replace('/suppliers/dashboard');
      
    } catch (error: any) {
      console.error('Registration error:', error);
      Alert.alert('Erreur', error.message || 'Une erreur est survenue lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: 'Inscription Fournisseur' }} />
      
      <Text style={styles.title}>Devenir Fournisseur ASMA Express</Text>
      <Text style={styles.subtitle}>
        Rejoignez notre plateforme B2B et développez votre business à l'international
      </Text>

      <View style={styles.form}>
        
        {/* SECTION IMAGES */}
        <Text style={styles.sectionTitle}>Images de l'entreprise</Text>
        
        {/* Logo */}
        <View style={styles.imageSection}>
          <Text style={styles.label}>Logo de l'entreprise</Text>
          <TouchableOpacity 
            style={styles.imageUpload}
            onPress={() => pickImage('logo')}
            disabled={uploadingImage}
          >
            {form.logo ? (
              <Image source={{ uri: form.logo }} style={styles.uploadedImage} />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Ionicons name="camera" size={32} color="#666" />
                <Text style={styles.uploadText}>Ajouter un logo</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Cover Image */}
        <View style={styles.imageSection}>
          <Text style={styles.label}>Image de couverture</Text>
          <TouchableOpacity 
            style={[styles.imageUpload, styles.coverUpload]}
            onPress={() => pickImage('cover')}
            disabled={uploadingImage}
          >
            {form.coverImage ? (
              <Image source={{ uri: form.coverImage }} style={styles.uploadedCoverImage} />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Ionicons name="image" size={32} color="#666" />
                <Text style={styles.uploadText}>Ajouter une bannière</Text>
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
        />

        <Text style={styles.label}>Mot de passe *</Text>
        <TextInput
          style={styles.input}
          value={form.password}
          onChangeText={(text) => setForm({...form, password: text})}
          placeholder="Minimum 6 caractères"
          secureTextEntry
        />

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

        {/* SECTION CATÉGORIES (NOUVELLE SECTION) */}
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
                      // Ajouter automatiquement aux catégories si pas déjà présent
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
                      // Retirer la catégorie
                      newSelectedCategories = form.selectedCategories.filter(id => id !== category.id);
                      
                      // Si c'était la catégorie principale, la changer
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
                      // Ajouter la catégorie
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
            
            {/* Aperçu des catégories sélectionnées */}
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

        {/* BOUTON D'INSCRIPTION */}
        <TouchableOpacity 
          style={[styles.button, (loading || loadingCategories) && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading || loadingCategories}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>
              {loadingCategories ? 'Chargement...' : 'Créer mon compte fournisseur'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
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
  // Styles pour l'upload d'images
  imageSection: {
    marginBottom: 20,
  },
  imageUpload: {
    height: 100,
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  coverUpload: {
    height: 80,
  },
  uploadedImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  uploadedCoverImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  uploadPlaceholder: {
    alignItems: 'center',
  },
  uploadText: {
    marginTop: 8,
    color: '#666',
    fontSize: 12,
  },
  // Styles pour les catégories
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