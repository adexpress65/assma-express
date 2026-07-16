// app/search-entrepreneurs.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { useMessages } from '../src/contexts/MessagesContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../src/config/firebase';


export default function SearchEntrepreneursScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { createConversation } = useMessages();
  const insets = useSafeAreaInsets();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);

  // ✅ URL placeholder sans fichier local
  const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/200/1A1A1A/FF6B00?text=ENT';

  useEffect(() => {
    loadCategories();
    loadCompanies();
  }, []);

  const loadCategories = async () => {
    try {
      const categoriesRef = collection(db, 'categories');
      const q = query(categoriesRef, limit(20));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const cats: any[] = [];
        snapshot.forEach((doc) => {
          cats.push({ id: doc.id, ...doc.data() });
        });
        setCategories(cats);
      } else {
        // Catégories par défaut
        setCategories([
          { id: 'tech', name: 'Tech & Digital', icon: 'laptop' },
          { id: 'food', name: 'Restauration', icon: 'restaurant' },
          { id: 'fashion', name: 'Mode', icon: 'shirt' },
          { id: 'services', name: 'Services', icon: 'construct' },
        ]);
      }
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
    }
  };

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const companiesRef = collection(db, 'companies');
      const q = query(
        companiesRef,
        where('status', '==', 'active'),
        limit(50)
      );
      
      const querySnapshot = await getDocs(q);
      const results: any[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        results.push(formatCompanyData(doc.id, data));
      });
      
      setCompanies(results);
    } catch (error) {
      console.error('Erreur chargement entreprises:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchCompanies = async (text: string) => {
    setSearchQuery(text);
    
    if (!text.trim()) {
      loadCompanies();
      return;
    }

    setLoading(true);
    try {
      const companiesRef = collection(db, 'companies');
      const q = query(
        companiesRef,
        where('status', '==', 'active'),
        where('name_lower', '>=', text.toLowerCase()),
        where('name_lower', '<=', text.toLowerCase() + '\uf8ff'),
        limit(20)
      );
      
      const querySnapshot = await getDocs(q);
      const results: any[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        results.push(formatCompanyData(doc.id, data));
      });
      
      setCompanies(results);
    } catch (error) {
      console.error('Erreur recherche:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterByCategory = async (categoryId: string | null) => {
    setSelectedCategory(categoryId);
    setLoading(true);
    
    try {
      const companiesRef = collection(db, 'companies');
      let q;
      
      if (categoryId) {
        q = query(
          companiesRef,
          where('status', '==', 'active'),
          where('categories', 'array-contains', categoryId),
          limit(50)
        );
      } else {
        q = query(
          companiesRef,
          where('status', '==', 'active'),
          limit(50)
        );
      }
      
      const querySnapshot = await getDocs(q);
      const results: any[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        results.push(formatCompanyData(doc.id, data));
      });
      
      setCompanies(results);
    } catch (error) {
      console.error('Erreur filtrage:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCompanyData = (id: string, data: any) => {
    return {
      id,
      ...data,
      displayName: data.name || 'Entreprise sans nom',
      photoURL: data.logo || data.coverImage || null,
      specialty: data.businessType || data.mainCategory || 'Entrepreneur',
      rating: data.stats?.rating || 4.5,
      reviewCount: data.stats?.reviewCount || 0,
      available: data.isActive || false,
      location: `${data.city || ''} ${data.country || ''}`.trim() || 'Localisation non spécifiée',
    };
  };

  // app/search-entrepreneurs.tsx - CORRECTION
const startConversation = async (company: any) => {
  if (!user) {
    Alert.alert('Connexion requise', 'Veuillez vous connecter');
    return;
  }

  try {
    setLoading(true);
    
    // ✅ UTILISER company.uid (le propriétaire) PAS company.id
    const ownerId = company.uid;
    
    if (!ownerId) {
      Alert.alert('Erreur', 'Cette entreprise n\'a pas de propriétaire associé');
      return;
    }
    
    console.log('📞 Contact entrepreneur:', {
      companyName: company.name,
      companyId: company.id,
      ownerId: ownerId
    });
    
    const conversationId = await createConversation({
      companyId: company.id,
      participants: [ownerId],
      type: 'entrepreneur',
      title: company.name || 'Entrepreneur',
    });
    
    // ✅ Message de bienvenue immédiat
    setTimeout(() => {
      router.push(`/conversation/${conversationId}`);
    }, 300);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    Alert.alert('Erreur', 'Impossible de démarrer la conversation');
  } finally {
    setLoading(false);
  }
};

  // ✅ Composant Avatar sans fichier local
  const CompanyAvatar = ({ company }: { company: any }) => {
    const [imageError, setImageError] = useState(false);
    
    const getInitials = (name: string) => {
      return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    };

    if (!company.photoURL || imageError) {
      return (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>
            {getInitials(company.displayName)}
          </Text>
        </View>
      );
    }

    return (
      <Image 
        source={{ uri: company.photoURL }}
        style={styles.avatar}
        onError={() => setImageError(true)}
      />
    );
  };

  const CompanyCard = ({ company }: { company: any }) => (
    <TouchableOpacity 
      style={styles.companyCard}
      onPress={() => startConversation(company)}
      activeOpacity={0.7}
    >
      <CompanyAvatar company={company} />
      
      <View style={styles.companyInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.companyName} numberOfLines={1}>
            {company.displayName}
          </Text>
          {company.verified && (
            <Ionicons name="checkmark-circle" size={16} color="#FF6B00" />
          )}
        </View>
        
        <Text style={styles.companySpecialty} numberOfLines={1}>
          {company.specialty}
        </Text>
        
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={12} color="#666" />
          <Text style={styles.locationText} numberOfLines={1}>
            {company.location}
          </Text>
        </View>
        
        <View style={styles.statsRow}>
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={14} color="#FFD600" />
            <Text style={styles.ratingText}>{company.rating}</Text>
            <Text style={styles.reviewCount}>({company.reviewCount})</Text>
          </View>
          
          {company.available && (
            <View style={styles.availableBadge}>
              <View style={styles.availableDot} />
              <Text style={styles.availableText}>Disponible</Text>
            </View>
          )}
        </View>
      </View>
      
      <TouchableOpacity 
        style={styles.messageBtn}
        onPress={() => startConversation(company)}
      >
        <Ionicons name="chatbubble" size={20} color="#FF6B00" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const CategoryPill = ({ category, isSelected, onPress }: any) => (
    <TouchableOpacity
      style={[
        styles.categoryPill,
        isSelected && styles.categoryPillSelected
      ]}
      onPress={onPress}
    >
      <Text style={[
        styles.categoryPillText,
        isSelected && styles.categoryPillTextSelected
      ]}>
        {category.name}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Entrepreneurs & Entreprises</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher une entreprise..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={searchCompanies}
          autoFocus
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => {
            setSearchQuery('');
            loadCompanies();
          }}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Categories horizontales */}
      <View style={styles.categoriesContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScrollContent}
        >
          <TouchableOpacity
            style={[
              styles.categoryPill,
              !selectedCategory && styles.categoryPillSelected
            ]}
            onPress={() => filterByCategory(null)}
          >
            <Text style={[
              styles.categoryPillText,
              !selectedCategory && styles.categoryPillTextSelected
            ]}>
              Tous
            </Text>
          </TouchableOpacity>
          
          {categories.map((category) => (
            <CategoryPill
              key={category.id}
              category={category}
              isSelected={selectedCategory === category.id}
              onPress={() => filterByCategory(category.id)}
            />
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={styles.loaderText}>Chargement des entreprises...</Text>
        </View>
      ) : (
        <FlatList
          data={companies}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CompanyCard company={item} />}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            companies.length > 0 ? (
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsCount}>
                  {companies.length} entreprise{companies.length > 1 ? 's' : ''} trouvée{companies.length > 1 ? 's' : ''}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            !loading && (
              <View style={styles.emptyState}>
                <Ionicons name="business-outline" size={64} color="#333" />
                <Text style={styles.emptyTitle}>Aucune entreprise trouvée</Text>
                <Text style={styles.emptyText}>
                  Aucune entreprise active pour le moment
                </Text>
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    paddingVertical: 14,
    marginLeft: 8,
    fontSize: 16,
  },
  categoriesContainer: {
    marginBottom: 8,
  },
  categoriesScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  categoryPillSelected: {
    backgroundColor: '#FF6B00',
    borderColor: '#FF6B00',
  },
  categoryPillText: {
    color: '#FFF',
    fontSize: 14,
  },
  categoryPillTextSelected: {
    color: '#FFF',
    fontWeight: '600',
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  resultsCount: {
    color: '#999',
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 20,
  },
  companyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    backgroundColor: '#000',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#333',
  },
  // ✅ Nouveau style pour le placeholder sans image
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#FF6B00',
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FF6B00',
    fontSize: 20,
    fontWeight: 'bold',
  },
  companyInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  companyName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  companySpecialty: {
    color: '#FF6B00',
    fontSize: 14,
    marginBottom: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationText: {
    color: '#666',
    fontSize: 12,
    marginLeft: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    color: '#FFF',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '600',
  },
  reviewCount: {
    color: '#666',
    fontSize: 12,
    marginLeft: 2,
  },
  availableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00C85320',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  availableDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00C853',
    marginRight: 4,
  },
  availableText: {
    color: '#00C853',
    fontSize: 11,
  },
  messageBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    color: '#999',
    marginTop: 12,
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
