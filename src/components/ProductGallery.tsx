import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Dimensions, StyleSheet, ScrollView } from 'react-native';
import { Image } from 'expo-image';

const { width } = Dimensions.get('window');
const blurhash = '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{olj[ayj[j[fQayayayayayayayaya{j[ayj[ayj[ayayayayayayayayoJ';

interface ProductGalleryProps {
  images: string[];
  productName: string;
}

const cleanFirebaseUrl = (url: string): string => {
  if (!url) return '';
  if (url.includes('alt=media')) return url;
  return url.includes('?') ? `${url}&alt=media` : `${url}?alt=media`;
};

export default function ProductGallery({ images = [], productName }: ProductGalleryProps) {
  const [selectedImage, setSelectedImage] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const processedImages = React.useMemo(() => {
    const cleaned = images.map(cleanFirebaseUrl);
    return cleaned.length > 0 ? cleaned : ['https://via.placeholder.com/400'];
  }, [images]);

  const onScroll = useCallback((event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    setSelectedImage(Math.round(index));
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.mainImageContainer}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {processedImages.map((imageUri, index) => (
            <View key={index.toString()} style={styles.imageSlide}>
              <Image
                source={{ uri: imageUri }}
                style={styles.mainImage}
                contentFit="contain"
                transition={300}
                placeholder={blurhash}
                cachePolicy="memory-disk"
              />
            </View>
          ))}
        </ScrollView>

        {processedImages.length > 1 && (
          <View style={styles.imageCounter}>
            <Text style={styles.imageCounterText}>
              {selectedImage + 1}/{processedImages.length}
            </Text>
          </View>
        )}
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.thumbnailsContainer}
        contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}
      >
        {processedImages.map((image, index) => (
          <TouchableOpacity 
            key={`thumb-${index}`} 
            onPress={() => scrollViewRef.current?.scrollTo({ x: index * width, animated: true })}
            style={[styles.thumbnail, selectedImage === index && styles.thumbnailSelected]}
          >
            <Image
              source={{ uri: image }}
              style={styles.thumbnailImage}
              contentFit="cover"
            />
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.productInfo}>
        <Text style={styles.productName}>{productName}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#FFF' },
  mainImageContainer: { height: width, position: 'relative' },
  imageSlide: { width: width, height: width },
  mainImage: { width: '100%', height: '100%' },
  imageCounter: {
    position: 'absolute',
    bottom: 15,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageCounterText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  thumbnailsContainer: { marginTop: 10, height: 70 },
  thumbnail: { width: 60, height: 60, borderRadius: 8, borderWidth: 1, borderColor: '#EEE', overflow: 'hidden' },
  thumbnailSelected: { borderColor: '#FF6A00', borderWidth: 2 },
  thumbnailImage: { width: '100%', height: '100%' },
  productInfo: { padding: 16 },
  productName: { fontSize: 18, fontWeight: 'bold', color: '#333' }
});