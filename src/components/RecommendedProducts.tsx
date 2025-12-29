// src/components/RecommendedProducts.tsx
import React, { useEffect, useState } from 'react';
import { View, FlatList, ActivityIndicator, Text } from 'react-native';
import { db } from '../../src/config/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import ProductCard from './ProductCard';
import { useRouter } from 'expo-router';

export default function RecommendedProducts({ category, excludeId }: any) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (!category) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const col = collection(db, 'products');
        const q = query(col, where('category', '==', category), limit(6));
        const snap = await getDocs(q);
        const list = snap.docs
          .map(d => ({ id: d.id, ...(d.data() as any) }))
          .filter(i => i.id !== excludeId);
        if (mounted) setItems(list);
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [category]);

  if (loading) return <ActivityIndicator style={{ marginTop: 8 }} />;

  if (!items.length) return <Text style={{ color: '#666' }}>Aucun recommandé.</Text>;

  return (
    <FlatList
      data={items}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(i) => i.id}
      renderItem={({ item }) => (
        <View style={{ width: 200, marginRight: 12 }}>
          <ProductCard product={item} onPress={() => router.push({ pathname: `/product/${item.id}` })} />
        </View>
      )}
    />
  );
}
