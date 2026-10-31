// mobile/src/components/chat/ProductMessage.tsx
import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export const ProductMessage = ({ message, isMine }) => {
  const router = useRouter();
  const { productInfo } = message;

  return (
    <View style={[styles.bubble, isMine ? styles.myBubble : styles.theirBubble]}>
      <TouchableOpacity 
        style={styles.card}
        onPress={() => router.push(`/product/wholesale/${productInfo.id}`)}
      >
        <Image source={{ uri: productInfo.image }} style={styles.image} />
        <View style={styles.details}>
          <Text style={styles.name} numberOfLines={2}>{productInfo.name}</Text>
          <Text style={styles.price}>{productInfo.price} CFA</Text>
        </View>
      </TouchableOpacity>
      <Text style={styles.text}>{message.text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  bubble: { maxWidth: '80%', padding: 8, borderRadius: 12, marginBottom: 10 },
  myBubble: { alignSelf: 'flex-end', backgroundColor: '#E3F2FD' },
  theirBubble: { alignSelf: 'flex-start', backgroundColor: '#FFF' },
  card: { 
    flexDirection: 'row', 
    backgroundColor: '#F8F8F8', 
    borderRadius: 8, 
    padding: 8,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: '#EEE'
  },
  image: { width: 50, height: 50, borderRadius: 4 },
  details: { flex: 1, marginLeft: 10 },
  name: { fontSize: 12, color: '#333' },
  price: { fontSize: 13, fontWeight: 'bold', color: '#FF6A00' },
  text: { fontSize: 14, color: '#444' }
});
