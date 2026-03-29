import React, { useState, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Dimensions, 
  StyleSheet, 
  ScrollView,
  Platform 
} from 'react-native';
// ✅ Utilisation de expo-image confirmée
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
// Blurhash optimisé pour un rendu de chargement professionnel
const blurhash = '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{olj[ayj[j[fQayayayayayayayaya{j[ayj[ayj[ayayayayayayayayoJ';

interface ProductGalleryProps {
  images: string[];
  productName: string;
  hasFreeShipping?: boolean; 
}

const cleanFirebaseUrl = (url: string): string => {
  if (!url) return '';
  if (url.includes('alt=media')) return url;
  return url.includes('?') ? `${url}&alt=media` : `${url}?alt=media`;
};

export default function ProductGallery({ images = [], productName, hasFreeShipping }: ProductGalleryProps) {
  const [selectedImage, setSelectedImage] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const processedImages = React.useMemo(() => {
    const cleaned = images.map(cleanFirebaseUrl);
    return cleaned.length > 0 ? cleaned : ['https://via.placeholder.com/400'];
  }, [images]);

  const onScroll = useCallback((event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    // Utilisation de Math.round pour éviter les sauts d'index pendant le scroll
    const roundIndex = Math.round(index);
    if (roundIndex !== selectedImage) {
        setSelectedImage(roundIndex);
    }
  }, [selectedImage]);

  const scrollToImage = (index: number) => {
    scrollViewRef.current?.scrollTo({ x: index * (width - 24), animated: true });
    setSelectedImage(index);
  };

  return (
    <View style={styles.container}>
      {/* Image principale avec cadre B2B */}
      <View style={styles.mainImageContainer}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          decelerationRate="fast"
          snapToInterval={width - 24} // Assure que le slide s'arrête pile au milieu
        >
          {processedImages.map((imageUri, index) => (
            <View key={index.toString()} style={styles.imageSlide}>
              <Image
                source={imageUri} // Directement l'URI avec expo-image
                style={styles.mainImage}
                contentFit="contain"
                transition={300}
                placeholder={blurhash}
                // ✅ Cache agressif pour éviter de recharger en swipant
                cachePolicy="memory-disk" 
              />
            </View>
          ))}
        </ScrollView>

        {/* Badge compteur modernisé */}
        {processedImages.length > 1 && (
          <View style={styles.imageCounter}>
            <Ionicons name="images-outline" size={12} color="#FFF" style={{ marginRight: 4 }} />
            <Text style={styles.imageCounterText}>
              {selectedImage + 1} / {processedImages.length}
            </Text>
          </View>
        )}

        {/* Boutons navigation (si plusieurs images) */}
        {processedImages.length > 1 && (
          <>
            <TouchableOpacity 
              style={[styles.navButton, styles.navButtonLeft]}
              onPress={() => scrollToImage(Math.max(0, selectedImage - 1))}
              disabled={selectedImage === 0}
            >
              <Ionicons 
                name="chevron-back" 
                size={24} 
                color={selectedImage === 0 ? '#CCC' : '#333'} 
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.navButton, styles.navButtonRight]}
              onPress={() => scrollToImage(Math.min(processedImages.length - 1, selectedImage + 1))}
              disabled={selectedImage === processedImages.length - 1}
            >
              <Ionicons 
                name="chevron-forward" 
                size={24} 
                color={selectedImage === processedImages.length - 1 ? '#CCC' : '#333'} 
              />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Indicateurs de pagination dots */}
      {processedImages.length > 1 && (
        <View style={styles.paginationContainer}>
          {processedImages.map((_, index) => (
            <TouchableOpacity
              key={`dot-${index}`}
              onPress={() => scrollToImage(index)}
              style={[
                styles.paginationDot,
                selectedImage === index && styles.paginationDotActive
              ]}
            />
          ))}
        </View>
      )}

      {/* Thumbnails avec design B2B */}
      {processedImages.length > 1 && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.thumbnailsContainer}
          contentContainerStyle={styles.thumbnailsContent}
        >
          {processedImages.map((image, index) => (
            <TouchableOpacity 
              key={`thumb-${index}`} 
              onPress={() => scrollToImage(index)}
              style={[
                styles.thumbnail, 
                selectedImage === index && styles.thumbnailSelected
              ]}
              activeOpacity={0.8}
            >
              <Image
                source={image}
                style={styles.thumbnailImage}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
              {selectedImage === index && (
                <View style={styles.thumbnailOverlay} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Info produit B2B */}
      <View style={styles.productInfo}>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Ionicons name="cube-outline" size={12} color="#FF6A00" />
            <Text style={styles.badgeText}>Produit B2B</Text>
          </View>
          
          {/* AJOUT DU BADGE LIVRAISON GRATUITE */}
          {hasFreeShipping && (
            <View style={[styles.badge, styles.freeShippingBadge]}>
              <Ionicons name="airplane-outline" size={12} color="#00B050" />
              <Text style={[styles.badgeText, styles.freeShippingText]}>Livraison gratuite</Text>
            </View>
          )}
        </View>
        <Text style={styles.productName}>{productName}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginHorizontal: 12,
    marginTop: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  
  mainImageContainer: { 
    height: width * 0.85, 
    position: 'relative',
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  
  imageSlide: { 
    width: width - 24, 
    height: width * 0.85,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  mainImage: { 
    width: '90%', 
    height: '90%',
  },

  imageCounter: {
    position: 'absolute',
    bottom: 15,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  imageCounterText: { 
    color: '#FFF', 
    fontSize: 13, 
    fontWeight: '600',
  },

  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  
  navButtonLeft: { left: 10 },
  navButtonRight: { right: 10 },

  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DDD',
  },
  
  paginationDotActive: {
    width: 24,
    backgroundColor: '#FF6A00',
    borderRadius: 4,
  },

  thumbnailsContainer: { 
    marginTop: 0,
    maxHeight: 90,
  },
  
  thumbnailsContent: { 
    gap: 12, 
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  
  thumbnail: { 
    width: 70, 
    height: 70, 
    borderRadius: 10, 
    borderWidth: 2, 
    borderColor: '#F0F0F0', 
    overflow: 'hidden',
    backgroundColor: '#FAFAFA',
  },
  
  thumbnailSelected: { 
    borderColor: '#FF6A00', 
    borderWidth: 2,
  },
  
  thumbnailImage: { 
    width: '100%', 
    height: '100%',
  },
  
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,106,0,0.1)',
  },

  productInfo: { 
    padding: 16,
    paddingTop: 8,
  },

  badgeRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5EE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFE4D6',
  },
  
  badgeText: {
    fontSize: 11,
    color: '#FF6A00',
    fontWeight: '600',
    marginLeft: 4,
  },

  freeShippingBadge: {
    borderColor: '#E8F5E9',
    backgroundColor: '#E8F5E9',
    marginLeft: 8,
  },
  freeShippingText: {
    color: '#00B050',
  },
  
  productName: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#1A1A1A',
    lineHeight: 26,
  }
});