import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  Dimensions, ScrollView
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function FreeProductsSection({ products = [] }) {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const autoScrollRef = useRef<ScrollView>(null);

  const normalizedProducts = useMemo(
    () =>
      products.map((item) => ({
        ...item,
        mainImage: item?.mainImage || item?.imageUrl || (Array.isArray(item?.images) ? item.images[0] : ''),
      })),
    [products]
  );

  const sideProducts = useMemo(() => normalizedProducts.slice(1, 3), [normalizedProducts]);
  const bottomProducts = useMemo(() => normalizedProducts.slice(3, 6), [normalizedProducts]);

  useEffect(() => {
    if (normalizedProducts.length <= 1) return;
    
    const interval = setInterval(() => {
      const nextIndex = (activeIndex + 1) % Math.min(normalizedProducts.length, 5);
      setActiveIndex(nextIndex);
      autoScrollRef.current?.scrollTo({ 
        x: nextIndex * (SCREEN_WIDTH * 0.6),
        animated: true 
      });
    }, 3500);

    return () => clearInterval(interval);
  }, [activeIndex, normalizedProducts.length]);

  useEffect(() => {
    const imageUris = normalizedProducts
      .slice(0, 8)
      .map((item) => item.mainImage)
      .filter(Boolean)
      .map((item) => String(item));

    if (!imageUris.length) {
      return;
    }

    Image.prefetch(imageUris, 'memory-disk').catch(() => {});
  }, [normalizedProducts]);

  const hasProducts = normalizedProducts.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <View style={styles.verticalBar} />
          <Text style={styles.title}>Zéro Dollars</Text>
        </View>
        <TouchableOpacity 
          style={styles.seeAllBtn}
          onPress={() => router.push('/shop/zero-dollars')} 
        >
          <Text style={styles.seeAllText}>Tout voir</Text>
          <Ionicons name="arrow-forward" size={14} color="#00B050" />
        </TouchableOpacity>
      </View>

      <View style={styles.gridContainer}>
        <View style={styles.bigCardContainer}>
          {hasProducts ? (
            <TouchableOpacity 
              activeOpacity={0.9}
              style={styles.bigCard}
              onPress={() => router.push(`/product/${normalizedProducts[activeIndex]?.id}`)}
            >
              <Image 
                source={normalizedProducts[activeIndex]?.mainImage} 
                style={styles.image} 
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={220}
              />
              <View style={styles.badgeGratuit}>
                <Text style={styles.badgeText}>GRATUIT</Text>
              </View>
              <View style={styles.overlay}>
                 <Text style={styles.productName} numberOfLines={1}>
                   {normalizedProducts[activeIndex]?.name}
                 </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              activeOpacity={0.9}
              style={[styles.bigCard, styles.bigCardEmpty]}
              onPress={() => router.push('/shop/zero-dollars')}
            >
              <Ionicons name="gift-outline" size={32} color="#00B050" />
              <Text style={styles.emptyTitle}>Offres 0 CFA bientôt disponibles</Text>
              <Text style={styles.emptySubtitle}>Touchez ici pour explorer la boutique Zéro Dollars</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.rightColumn}>
          {sideProducts.map((item) => (
            <TouchableOpacity 
              key={item.id} 
              style={styles.smallCard}
              onPress={() => router.push(`/product/${item.id}`)}
            >
              <Image
                source={item.mainImage}
                style={styles.image}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={120}
              />
            </TouchableOpacity>
          ))}
          {sideProducts.length < 2 && (
            <TouchableOpacity
              style={[styles.smallCard, styles.infoCard]}
              onPress={() => router.push('/shop/zero-dollars')}
              activeOpacity={0.9}
            >
              <View style={styles.infoCardContent}>
                <Ionicons name="gift-outline" size={24} color="#00B050" />
                <Text style={styles.infoCardTitle}>Plus de gratuités</Text>
                <Text style={styles.infoCardText}>Offres 0 CFA prêtes à explorer</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Text style={styles.subtitle}>Nouveautés gratuites</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {bottomProducts.map((item) => (
          <TouchableOpacity 
            key={item.id} 
            style={styles.bottomCard}
            onPress={() => router.push(`/product/${item.id}`)}
          >
            <Image
              source={item.mainImage}
              style={styles.bottomImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={120}
            />
            <Text style={styles.bottomPrice}>0 CFA</Text>
          </TouchableOpacity>
        ))}
        {bottomProducts.length < 3 && (
          <TouchableOpacity
            style={[styles.bottomCard, styles.bottomCtaCard]}
            onPress={() => router.push('/shop/zero-dollars')}
            activeOpacity={0.9}
          >
            <View style={styles.bottomCtaInner}>
              <Ionicons name="sparkles-outline" size={26} color="#00B050" />
              <Text style={styles.bottomCtaTitle}>Explorer</Text>
              <Text style={styles.bottomCtaText}>plus d’articles gratuits</Text>
            </View>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingVertical: 15,
    marginVertical: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginBottom: 12,
  },
  titleContainer: { flexDirection: 'row', alignItems: 'center' },
  verticalBar: {
    width: 4,
    height: 18,
    backgroundColor: '#00B050',
    borderRadius: 2,
    marginRight: 8,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  seeAllText: { color: '#00B050', fontSize: 12, fontWeight: '700', marginRight: 4 },
  gridContainer: {
    flexDirection: 'row',
    height: 220,
    paddingHorizontal: 15,
    gap: 10,
  },
  bigCardContainer: { flex: 1.8 },
  bigCard: {
    width: '100%',
    height: '100%',
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: '#f9f9f9',
  },
  bigCardEmpty: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  rightColumn: { flex: 1, gap: 10 },
  smallCard: { flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#f9f9f9' },
  infoCard: {
    borderWidth: 1,
    borderColor: '#d8f1de',
    backgroundColor: '#f6fff8',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  infoCardContent: { alignItems: 'center' },
  infoCardTitle: { marginTop: 8, color: '#0b7c39', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  infoCardText: { marginTop: 4, color: '#5d7a64', fontSize: 11, textAlign: 'center', lineHeight: 15 },
  image: { width: '100%', height: '100%' },
  badgeGratuit: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#00B050',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  overlay: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  productName: { color: '#fff', fontSize: 11, fontWeight: '600' },
  emptyTitle: { marginTop: 8, color: '#0b7c39', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  emptySubtitle: { marginTop: 4, color: '#5d7a64', fontSize: 11, textAlign: 'center', lineHeight: 15 },
  subtitle: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 15,
    marginTop: 20,
    marginBottom: 10,
    color: '#555'
  },
  scrollContent: { paddingHorizontal: 15, gap: 12 },
  bottomCard: { width: 100, alignItems: 'flex-start' },
  bottomImage: { width: 100, height: 100, borderRadius: 12, backgroundColor: '#f5f5f5' },
  bottomPrice: { marginTop: 5, fontWeight: '800', color: '#00B050', fontSize: 13 },
  bottomCtaCard: {
    height: 126,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8f1de',
    backgroundColor: '#f6fff8',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  bottomCtaInner: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  bottomCtaTitle: { marginTop: 8, fontSize: 14, fontWeight: '800', color: '#00B050' },
  bottomCtaText: { marginTop: 4, fontSize: 11, color: '#5d7a64', textAlign: 'center', lineHeight: 15 }
});
