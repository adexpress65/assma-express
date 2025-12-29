// src/components/ImageGallery.tsx
import React, { useState } from 'react';
import { View, FlatList, Image, TouchableOpacity, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export default function ImageGallery({ images = [], style }: { images?: string[]; style?: any }) {
  const [active, setActive] = useState(0);
  if (!images.length) return <View style={[{ height: width * 0.6, backgroundColor: '#f3f3f3' }, style]} />;
  return (
    <View>
      <Image
        source={{ uri: images[active] }}
        style={[{ width: '100%', height: width * 0.9, borderRadius: 8 }, style]}
        resizeMode="cover"
      />
      <FlatList
        data={images}
        keyExtractor={(i, idx) => `${idx}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 8 }}
        renderItem={({ item, index }) => (
          <TouchableOpacity onPress={() => setActive(index)} style={{ marginRight: 8 }}>
            <Image
              source={{ uri: item }}
              style={{
                width: 64,
                height: 64,
                borderRadius: 6,
                borderWidth: index === active ? 2 : 0,
                borderColor: '#ff6a00'
              }}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
