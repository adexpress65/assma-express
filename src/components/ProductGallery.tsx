// mobile/src/components/ProductGallery.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, Dimensions, StyleSheet, ScrollView } from 'react-native';

const { width } = Dimensions.get('window');

interface ProductGalleryProps {
  images: string[];
  productName: string;
}

export default function ProductGallery({ images = [], productName }: ProductGalleryProps) {
  const [selectedImage, setSelectedImage] = useState(0);

  // Fallback si pas d'images
  if (!images || images.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.placeholderImage}>
          <Text style={styles.placeholderText}>Aucune image</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Image principale */}
      <View style={styles.mainImageContainer}>
        <Image
          source={{ uri: images[selectedImage] }}
          style={styles.mainImage}
          resizeMode="cover"
        />
        <View style={styles.imageCounter}>
          <Text style={styles.imageCounterText}>Photos {selectedImage + 1}/{images.length}</Text>
        </View>
        <TouchableOpacity style={styles.nextButton}>
          <Text style={styles.nextButtonText}>Plus &gt;</Text>
        </TouchableOpacity>
      </View>

      {/* Miniatures */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailsContainer}>
        {images.map((image, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => setSelectedImage(index)}
            style={[
              styles.thumbnail,
              selectedImage === index && styles.thumbnailSelected
            ]}
          >
            <Image
              source={{ uri: image }}
              style={styles.thumbnailImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Options et Points forts */}
      <View style={styles.optionsContainer}>
        <Text style={styles.optionsText}>Options</Text>
        <Text style={styles.highlightsText}>Points forts</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  mainImageContainer: {
    position: 'relative',
  },
  mainImage: {
    width: width,
    height: width * 0.8,
  },
  placeholderImage: {
    width: width,
    height: width * 0.8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
    fontSize: 16,
  },
  imageCounter: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  imageCounterText: {
    color: '#fff',
    fontSize: 12,
  },
  nextButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  thumbnailsContainer: {
    padding: 16,
  },
  thumbnail: {
    width: 60,
    height: 60,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  thumbnailSelected: {
    borderColor: '#ff6a00',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  optionsText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  highlightsText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
});