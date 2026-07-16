import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  ScrollView
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getLocalizedProductText } from '@/utils/productLocale';
import { useCurrency } from '@/contexts/CurrencyContext';

type Normalized = {
  id: string;
  name?: string;
  mainImage: string;
  imageUrl?: string | null;
  images?: string[];
  [key: string]: unknown;
};

type FreeProduct = {
  id: string;
  name?: string;
  mainImage?: string | null;
  imageUrl?: string | null;
  images?: string[];
  price?: number;
  originalPrice?: number;
  supplier?: string;
  categoryId?: string;
};

interface FreeProductsSectionProps {
  products?: FreeProduct[];
}

/** Un seul produit par image (évite la même photo en plusieurs cases). */
function dedupeByIdAndImage(products: Normalized[]): Normalized[] {
  const seenId = new Set<string>();
  const seenImg = new Set<string>();
  const out: Normalized[] = [];
  for (const p of products) {
    if (!p?.id || seenId.has(p.id)) continue;
    const img = String(p.mainImage || p.imageUrl || "").trim().toLowerCase();
    if (img && seenImg.has(img)) continue;
    seenId.add(p.id);
    if (img) seenImg.add(img);
    out.push(p);
  }
  return out;
}

/**
 * Grande carte = hero ; colonne droite = 2 produits suivants ; bandeau = suivants,
 * sans réutiliser le même id ni la même image sur l’écran.
 */
function layoutSlots(heroIndex: number, pool: Normalized[]) {
  const n = pool.length;
  if (n === 0) {
    return { hero: undefined as Normalized | undefined, side: [] as Normalized[], bottom: [] as Normalized[] };
  }
  const hi = ((heroIndex % n) + n) % n;
  const hero = pool[hi];
  const others = pool.filter((_, idx) => idx !== hi);
  const side = others.slice(0, 2);
  const used = new Set<string>([hero.id, ...side.map((s) => s.id)]);
  const bottom = pool.filter((p) => !used.has(p.id)).slice(0, 6);
  return { hero, side, bottom };
}

export default function FreeProductsSection({ products = [] }: FreeProductsSectionProps) {
  const { t, i18n } = useTranslation();
  const { formatPrice } = useCurrency();
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);

  const normalizedProducts = useMemo(() => {
    const raw = products.map((item) => ({
      ...item,
      mainImage:
        item?.mainImage ||
        item?.imageUrl ||
        (Array.isArray(item?.images) ? item.images[0] : ""),
    })) as Normalized[];
    return dedupeByIdAndImage(raw);
  }, [products]);

  const hasProducts = normalizedProducts.length > 0;

  const { hero: heroProduct, side: sideProducts, bottom: bottomProducts } = useMemo(
    () => layoutSlots(activeIndex, normalizedProducts),
    [activeIndex, normalizedProducts],
  );

  useEffect(() => {
    if (normalizedProducts.length <= 1) return;

    let timer: NodeJS.Timeout | null = null;

    const scheduleNext = () => {
      const delay = 30_000 + Math.random() * 15_000;
      timer = setTimeout(() => {
        setActiveIndex((prev) => {
          const n = normalizedProducts.length;
          if (n <= 1) return 0;
          return (prev + 1) % n;
        });
        scheduleNext();
      }, delay);
    };

    scheduleNext();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [normalizedProducts.length]);

  useEffect(() => {
    setActiveIndex((prev) => {
      const n = normalizedProducts.length;
      if (n === 0) return 0;
      return prev >= n ? 0 : prev;
    });
  }, [normalizedProducts.length]);

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <View style={styles.verticalBar} />
          <Text style={styles.title}>{t('app.premium.zeroDollarsTitle')}</Text>
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
          {hasProducts && heroProduct ? (
            <TouchableOpacity 
              activeOpacity={0.9}
              style={styles.bigCard}
              onPress={() => router.push(`/product/${heroProduct.id}`)}
            >
              <Image 
                source={heroProduct.mainImage} 
                style={styles.image} 
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={0}
              />
              <View style={styles.badgeGratuit}>
                <Text style={styles.badgeText}>{t('app.premium.badgeFree')}</Text>
              </View>
              <View style={styles.overlay}>
                 <Text style={styles.productName} numberOfLines={1}>
                   {getLocalizedProductText(
                     String(heroProduct.name ?? ''),
                     'name',
                     heroProduct as Record<string, unknown>,
                     i18n.language,
                   )}
                 </Text>
              </View>
            </TouchableOpacity>
          ) : !hasProducts ? (
            <TouchableOpacity 
              activeOpacity={0.9}
              style={[styles.bigCard, styles.bigCardEmpty]}
              onPress={() => router.push('/shop/zero-dollars')}
            >
              <Ionicons name="gift-outline" size={32} color="#00B050" />
              <Text style={styles.emptyTitle}>Offres 0 CFA bientôt disponibles</Text>
              <Text style={styles.emptySubtitle}>Touchez ici pour explorer la boutique Zéro Dollars</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.rightColumn}>
          {sideProducts.map((item) => (
            <TouchableOpacity 
              key={`side-${item.id}`} 
              style={styles.smallCard}
              onPress={() => router.push(`/product/${item.id}`)}
            >
              <Image
                source={item.mainImage}
                style={styles.image}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={0}
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
                <Text style={styles.infoCardTitle}>{t('app.premium.zeroDollarsMoreTitle')}</Text>
                <Text style={styles.infoCardText}>{t('app.premium.zeroDollarsMoreText')}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Text style={styles.subtitle}>{t('app.premium.zeroDollarsSubtitle')}</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {bottomProducts.map((item, idx) => (
          <TouchableOpacity 
            key={`bottom-${item.id}-${idx}`} 
            style={styles.bottomCard}
            onPress={() => router.push(`/product/${item.id}`)}
          >
            <Image
              source={item.mainImage}
              style={styles.bottomImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={0}
            />
            <Text style={styles.bottomPrice}>{formatPrice(0)}</Text>
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
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
  },
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
