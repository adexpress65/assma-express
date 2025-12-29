// src/components/premium/CategoryGridPremium.tsx - VERSION COMPLÈTE
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

const { width } = Dimensions.get('window');

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  count: number;
  firestoreId?: string;
}

interface CategoryGridPremiumProps {
  categories: Category[];
}

export default function CategoryGridPremium({ categories }: CategoryGridPremiumProps) {
  const router = useRouter();
  const [realCategories, setRealCategories] = useState<Category[]>(categories);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRealCategories = async () => {
      try {
        console.log('🔍 Chargement des catégories depuis Firestore...');
        
        const categoriesSnapshot = await getDocs(collection(db, 'categories'));
        const firestoreCategories = categoriesSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || 'Catégorie',
          icon: getCategoryIcon(doc.data().name),
          color: getCategoryColor(doc.data().name),
          count: 0,
          firestoreId: doc.id
        }));

        console.log(`✅ ${firestoreCategories.length} catégories chargées depuis Firestore`);
        
        if (firestoreCategories.length > 0) {
          setRealCategories(firestoreCategories);
        } else {
          const mappedCategories = categories.map(cat => ({
            ...cat,
            firestoreId: mapCategoryNameToId(cat.name)
          }));
          setRealCategories(mappedCategories);
        }
        
      } catch (error) {
        console.error('❌ Erreur chargement catégories:', error);
        const mappedCategories = categories.map(cat => ({
          ...cat,
          firestoreId: mapCategoryNameToId(cat.name)
        }));
        setRealCategories(mappedCategories);
      } finally {
        setLoading(false);
      }
    };

    loadRealCategories();
  }, []);

  // 🎨 ICÔNES PROFESSIONNELLES AVEC Ionicons et MaterialIcons
  const getCategoryIcon = (categoryName: string): string => {
    const iconMap: { [key: string]: { lib: 'ionicons' | 'material' | 'fontawesome5', name: string } } = {
      'machine': { lib: 'material', name: 'build' },
      'industriel': { lib: 'material', name: 'engineering' },
      'électronique': { lib: 'material', name: 'devices' },
      'téléphone': { lib: 'material', name: 'smartphone' },
      'informatique': { lib: 'material', name: 'computer' },
      'vêtement': { lib: 'material', name: 'checkroom' },
      'mode': { lib: 'material', name: 'style' },
      'aliment': { lib: 'material', name: 'restaurant' },
      'nourriture': { lib: 'material', name: 'fastfood' },
      'construction': { lib: 'material', name: 'architecture' },
      'outil': { lib: 'material', name: 'handyman' },
      'santé': { lib: 'material', name: 'medical-services' },
      'médical': { lib: 'material', name: 'medication' },
      'beauté': { lib: 'material', name: 'spa' },
      'cosmétique': { lib: 'material', name: 'face' },
      'sport': { lib: 'material', name: 'sports' },
      'fitness': { lib: 'material', name: 'fitness-center' },
      'maison': { lib: 'material', name: 'home' },
      'décoration': { lib: 'material', name: 'light' },
      'voiture': { lib: 'material', name: 'directions-car' },
      'automobile': { lib: 'material', name: 'car-repair' },
      'livraison': { lib: 'material', name: 'local-shipping' },
      'logistique': { lib: 'material', name: 'warehouse' }
    };
    
    for (const [key, icon] of Object.entries(iconMap)) {
      if (categoryName.toLowerCase().includes(key)) return JSON.stringify(icon);
    }
    
    // Icône par défaut
    return JSON.stringify({ lib: 'material', name: 'category' });
  };

  // 🎨 COULEURS PROFESSIONNELLES
  const getCategoryColor = (categoryName: string): string => {
    const colors: { [key: string]: string } = {
      'machine': '#4A6572',      // Bleu-gris professionnel
      'industriel': '#344955',   // Bleu-gris foncé
      'électronique': '#2196F3', // Bleu vif
      'informatique': '#1976D2', // Bleu royal
      'vêtement': '#FF6A00',     // Orange Assma
      'mode': '#E91E63',         // Rose fashion
      'aliment': '#4CAF50',      // Vert frais
      'construction': '#FF9800', // Orange construction
      'santé': '#F44336',        // Rouge médical
      'beauté': '#9C27B0',       // Violet beauté
      'sport': '#009688',        // Turquoise sport
      'maison': '#795548',       // Marron maison
      'voiture': '#607D8B',      // Gris automobile
      'livraison': '#FF5722'     // Orange livraison
    };
    
    for (const [key, color] of Object.entries(colors)) {
      if (categoryName.toLowerCase().includes(key)) return color;
    }
    return '#666666';
  };

  // 🎨 COMPOSANT ICÔNE PROFESSIONNEL
  const ProfessionalIcon = ({ iconData, size = 24, color = "#fff" }: { 
    iconData: string, 
    size?: number, 
    color?: string 
  }) => {
    try {
      const icon = JSON.parse(iconData);
      
      switch (icon.lib) {
        case 'ionicons':
          return <Ionicons name={icon.name as any} size={size} color={color} />;
        case 'material':
          return <MaterialIcons name={icon.name as any} size={size} color={color} />;
        case 'fontawesome5':
          return <FontAwesome5 name={icon.name as any} size={size} color={color} />;
        default:
          return <MaterialIcons name="category" size={size} color={color} />;
      }
    } catch {
      return <MaterialIcons name="category" size={size} color={color} />;
    }
  };

  const mapCategoryNameToId = (categoryName: string): string => {
    const mapping: { [key: string]: string } = {
      'machines industrielles': 'machines_industrielles',
      'électronique': 'electronique',
      'vêtements': 'vetements',
      'alimentation': 'alimentation',
      'construction': 'construction',
      'santé': 'sante',
      'beauté': 'beaute',
      'sports': 'sports',
      'maison': 'maison',
      'automobile': 'automobile'
    };
    
    return mapping[categoryName.toLowerCase()] || categoryName.toLowerCase();
  };

  const handleCategoryPress = (category: Category) => {
    console.log(`🔄 Navigation catégorie: ${category.name}`);
    
    const categoryId = category.firestoreId || category.id;
    
    router.push({
      pathname: '/category/[id]',
      params: { 
        id: categoryId,
        name: encodeURIComponent(category.name)
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Chargement des catégories...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Premium */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <View style={styles.titleIcon}>
            <MaterialIcons name="widgets" size={24} color="#FF6A00" />
          </View>
          <View>
            <Text style={styles.title}>Catégories Premium</Text>
            <Text style={styles.subtitle}>Explorez nos univers professionnels</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.seeAllButton}
          onPress={() => router.push('/categories')}
        >
          <Text style={styles.seeAllText}>Tout explorer</Text>
          <MaterialIcons name="arrow-forward-ios" size={14} color="#ff6a00" />
        </TouchableOpacity>
      </View>

      {/* Grid de Catégories Professionnel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesContainer}
      >
        {realCategories.map((category, index) => (
          <TouchableOpacity
            key={category.id}
            style={styles.categoryItem}
            activeOpacity={0.9}
            onPress={() => handleCategoryPress(category)}
          >
            {/* Cercle d'icône professionnel */}
            <LinearGradient
              colors={[category.color, `${category.color}DD`]}
              style={[
                styles.categoryIconContainer,
                index % 4 === 0 && styles.categoryIconFeatured,
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.iconBackground}>
                <ProfessionalIcon 
                  iconData={category.icon} 
                  size={index % 4 === 0 ? 28 : 24} 
                  color="#fff" 
                />
              </View>
              
              {/* Badge TOP pour les premières catégories */}
              {index < 3 && (
                <View style={styles.featuredBadge}>
                  <MaterialIcons name="star" size={10} color="#fff" />
                </View>
              )}
            </LinearGradient>
            
            {/* Informations catégorie */}
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryName} numberOfLines={2}>
                {category.name}
              </Text>
              <View style={styles.categoryMeta}>
                <Text style={styles.categoryCount}>
                  {category.count > 0 ? `${category.count}+ produits` : 'Découvrir'}
                </Text>
                <View style={styles.arrowContainer}>
                  <MaterialIcons name="chevron-right" size={12} color="#ff6a00" />
                </View>
              </View>
            </View>

            {/* Effet de brillance au survol */}
            <View style={styles.hoverEffect} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Barre de recherche rapide premium */}
      <View style={styles.quickSearchContainer}>
        <View style={styles.quickSearchHeader}>
          <MaterialIcons name="bolt" size={18} color="#FF6A00" />
          <Text style={styles.quickSearchTitle}>Recherche Express</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickSearchTags}
        >
          {[
            { label: 'B2B', icon: 'business' },
            { label: 'Grossiste', icon: 'inventory' },
            { label: 'Verifié', icon: 'verified' },
            { label: 'Express', icon: 'rocket' },
            { label: 'Qualité', icon: 'workspace-premium' },
            { label: 'Livraison Rapide', icon: 'local-shipping' }
          ].map((tag, index) => (
            <TouchableOpacity 
              key={tag.label} 
              style={[
                styles.tag,
                index === 0 && styles.tagFeatured
              ]}
              onPress={() => router.push(`/search?tag=${tag.label}`)}
            >
              <MaterialIcons name={tag.icon as any} size={14} color="#ff6a00" />
              <Text style={styles.tagText}>{tag.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

// 🎨 STYLES PROFESSIONNELS
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingVertical: 24,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f8f9fa',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  titleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 106, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 106, 0, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 106, 0, 0.15)',
  },
  seeAllText: {
    color: '#ff6a00',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 6,
  },
  categoriesContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  categoryItem: {
    width: 140,
    marginHorizontal: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1.5,
    borderColor: '#f8f9fa',
    position: 'relative',
    overflow: 'hidden',
  },
  categoryIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  categoryIconFeatured: {
    width: 80,
    height: 80,
    borderRadius: 22,
  },
  iconBackground: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuredBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FFD700',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  categoryInfo: {
    alignItems: 'center',
    width: '100%',
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 18,
  },
  categoryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCount: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
    marginRight: 4,
  },
  arrowContainer: {
    opacity: 0.8,
  },
  hoverEffect: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 106, 0, 0.02)',
    opacity: 0,
  },
  quickSearchContainer: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  quickSearchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  quickSearchTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginLeft: 8,
  },
  quickSearchTags: {
    paddingRight: 16,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 106, 0, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 106, 0, 0.15)',
  },
  tagFeatured: {
    backgroundColor: 'rgba(255, 106, 0, 0.12)',
    borderColor: 'rgba(255, 106, 0, 0.3)',
  },
  tagText: {
    color: '#ff6a00',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
});