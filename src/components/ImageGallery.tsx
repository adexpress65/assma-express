import React, { useState, useRef } from 'react';
import { 
  View, 
  FlatList, 
  TouchableOpacity, 
  Dimensions, 
  StyleSheet, 
  NativeSyntheticEvent, 
  NativeScrollEvent 
} from 'react-native';
// 1. Importer Image de expo-image
import { Image } from 'expo-image';

const { width } = Dimensions.get('window');
const blurhash = '|rF?hV%2WCj[ayayj[azj[j[ayayayayayayayayj[';

interface ImageGalleryProps {
  images: string[];
  style?: any;
}

export default function ImageGallery({ images = [], style }: ImageGalleryProps) {
  const [active, setActive] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  if (!images.length) {
    return <View style={[styles.placeholder, style]} />;
  }

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    const roundIndex = Math.round(index);
    if (roundIndex !== active) {
      setActive(roundIndex);
    }
  };

  const scrollToImage = (index: number) => {
    setActive(index);
    flatListRef.current?.scrollToIndex({ index, animated: true });
  };

  return (
    <View style={styles.container}>
      {/* IMAGE PRINCIPALE (SWIPABLE) */}
      <FlatList
        ref={flatListRef}
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(_, idx) => `main-${idx}`}
        renderItem={({ item }) => (
          <Image
            source={item} // Pas besoin de { uri: item } avec expo-image
            style={[styles.mainImage, style]}
            contentFit="cover"
            placeholder={blurhash}
            transition={300}
            cachePolicy="memory-disk"
          />
        )}
      />

      {/* INDICATEUR DE PAGINATION */}
      <View style={styles.pagination}>
        {images.map((_, index) => (
          <View 
            key={index} 
            style={[styles.dot, active === index ? styles.activeDot : styles.inactiveDot]} 
          />
        ))}
      </View>

      {/* MINIATURES */}
      <View style={styles.thumbnailContainer}>
        <FlatList
          data={images}
          keyExtractor={(i, idx) => `thumb-${idx}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <TouchableOpacity 
              onPress={() => scrollToImage(index)} 
              activeOpacity={0.8}
              style={[
                styles.thumbWrapper, 
                { borderColor: index === active ? '#ff6a00' : 'transparent', borderWidth: 2 }
              ]}
            >
              <Image 
                source={item} 
                style={styles.thumbnail}
                contentFit="cover"
                cachePolicy="memory-disk" // Utilise le même cache que l'image principale !
              />
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ... tes styles restent identiques
  container: { backgroundColor: '#FFF' },
  placeholder: { width: width, height: width, backgroundColor: '#f3f3f3' },
  mainImage: { width: width, height: width },
  pagination: { flexDirection: 'row', position: 'absolute', bottom: 110, alignSelf: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 4 },
  activeDot: { backgroundColor: '#ff6a00', width: 20 },
  inactiveDot: { backgroundColor: 'rgba(255, 255, 255, 0.8)' },
  thumbnailContainer: { padding: 10 },
  thumbWrapper: { marginRight: 8, borderRadius: 6, overflow: 'hidden' },
  thumbnail: { width: 60, height: 60 }
});