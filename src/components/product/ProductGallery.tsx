import React, { useState, useRef } from 'react';
import { 
  View, 
  Image, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Text
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Les couleurs AliExpress mixées avec vos couleurs primaires
const COLORS = {
  primary: '#ff6a00', // Votre orange
  aliExpressRed: '#eb0505',
  overlay: 'rgba(0, 0, 0, 0.4)',
  white: '#FFFFFF',
  textLight: '#718096',
  successGreen: '#00B517'
};

type Props = {
  images: string[];
  productName?: string;
};

export default function ProductGallery({ images, productName }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});
  const flatListRef = useRef<FlatList>(null);

  const cleanFirebaseUrl = (url: string): string => {
    if (!url) return '';
    if (url.includes('firebasestorage.googleapis.com')) {
      try {
        const baseUrl = url.split('?')[0];
        return `${baseUrl}?alt=media`;
      } catch (error) {
        return url;
      }
    }
    return url;
  };

  const renderImage = ({ item, index }: { item: string; index: number }) => {
    const isError = imageErrors[index];
    const cleanedUrl = cleanFirebaseUrl(item);
    
    return (
      <View style={styles.imageContainer}>
        {isError ? (
          <View style={styles.errorContainer}>
            <Ionicons name="image-outline" size={50} color="#ccc" />
            <Text style={styles.errorText}>Image non disponible</Text>
          </View>
        ) : (
          <Image
            source={{ uri: cleanedUrl }}
            style={styles.productImage}
            resizeMode="cover"
            onError={() => setImageErrors(prev => ({ ...prev, [index]: true }))}
          />
        )}
      </View>
    );
  };

  if (!images || images.length === 0) {
    return (
      <View style={styles.placeholderContainer}>
        <Ionicons name="image-outline" size={80} color="#ccc" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        horizontal
        data={images}
        keyExtractor={(_, index) => `image-${index}`}
        renderItem={renderImage}
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setActiveIndex(index);
        }}
      />
      
      {/* Badge "Article X/Y" - Style AliExpress */}
      <View style={styles.topBadgeContainer}>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>Article {activeIndex + 1}/{images.length}</Text>
        </View>
      </View>

      {/* Preuve sociale - "20 people gave it a positive review" */}
      <View style={styles.socialProofBadge}>
        <View style={styles.socialIconContainer}>
          <Ionicons name="thumbs-up" size={12} color={COLORS.white} />
        </View>
        <Text style={styles.socialProofText}>20 personnes ont donné un avis positif</Text>
      </View>

      {/* Bouton de favoris (Cœur) */}
      <TouchableOpacity style={styles.favoriteButton}>
        <Ionicons name="heart-outline" size={24} color="#333" />
      </TouchableOpacity>

      {/* Pagination à petits points discrets */}
      <View style={styles.pagination}>
        {images.map((_, index) => (
          <View
            key={`dot-${index}`}
            style={[
              styles.dot,
              index === activeIndex ? styles.activeDot : styles.inactiveDot
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    position: 'relative',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.1, // Format AliExpress légèrement plus haut que large
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  topBadgeContainer: {
    position: 'absolute',
    top: 20,
    left: 16,
    flexDirection: 'row',
    gap: 8,
  },
  countBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 15,
  },
  countText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  favoriteButton: {
    position: 'absolute',
    top: 20,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.8)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  socialProofBadge: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingRight: 12,
    paddingLeft: 4,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  socialIconContainer: {
    backgroundColor: '#ff4b4b',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  socialProofText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  pagination: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 15,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    height: 3,
    borderRadius: 2,
    marginHorizontal: 2,
  },
  activeDot: {
    width: 12,
    backgroundColor: COLORS.primary,
  },
  inactiveDot: {
    width: 6,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  errorContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  errorText: {
    marginTop: 10,
    color: COLORS.textLight,
    fontSize: 12,
  },
  placeholderContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
});