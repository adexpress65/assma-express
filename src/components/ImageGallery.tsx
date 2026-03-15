import React, { useState, useRef } from 'react';
import { 
  View, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  Dimensions, 
  StyleSheet, 
  NativeSyntheticEvent, 
  NativeScrollEvent 
} from 'react-native';

const { width } = Dimensions.get('window');

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

  // Gère le changement d'index lors du swipe
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    const roundIndex = Math.round(index);
    if (roundIndex !== active) {
      setActive(roundIndex);
    }
  };

  // Permet de cliquer sur une miniature pour scroller l'image principale
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
        keyExtractor={(_, idx) => `main-${idx}`}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={[styles.mainImage, style]}
            resizeMode="cover"
          />
        )}
      />

      {/* INDICATEUR DE PAGINATION (BULLES) */}
      <View style={styles.pagination}>
        {images.map((_, index) => (
          <View 
            key={index} 
            style={[styles.dot, active === index ? styles.activeDot : styles.inactiveDot]} 
          />
        ))}
      </View>

      {/* MINIATURES (Cliquables) */}
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
              <Image source={{ uri: item }} style={styles.thumbnail} />
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
  },
  placeholder: {
    width: width,
    height: width,
    backgroundColor: '#f3f3f3',
  },
  mainImage: {
    width: width,
    height: width, // Format carré AliExpress
  },
  pagination: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 110, // Juste au dessus des miniatures
    alignSelf: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#ff6a00',
    width: 20, // Effet pilule pour l'actif
  },
  inactiveDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  thumbnailContainer: {
    padding: 10,
  },
  thumbWrapper: {
    marginRight: 8,
    borderRadius: 6,
    overflow: 'hidden',
  },
  thumbnail: {
    width: 60,
    height: 60,
  }
});
