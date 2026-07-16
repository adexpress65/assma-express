import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  FlatList,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_MARGIN = 4;
const SLIDE_WIDTH = SCREEN_WIDTH - H_MARGIN * 2;
const MAIN_IMAGE_RATIO = 0.92;

const blurhash =
  '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{olj[ayj[j[fQayayayayayayayaya{j[ayj[ayj[ayayayayayayayayoJ';

const THUMB_SIZE = 68;
const THUMB_GAP = 10;

export interface ProductGalleryProps {
  images: string[];
  productName?: string;
  hasFreeShipping?: boolean;
}

const cleanFirebaseUrl = (url: string): string => {
  if (!url) return '';
  if (url.includes('alt=media')) return url;
  return url.includes('?') ? `${url}&alt=media` : `${url}?alt=media`;
};

type SlideProps = {
  imageUri: string;
  index: number;
  height: number;
};

const GallerySlide = React.memo(function GallerySlide({ imageUri, index, height }: SlideProps) {
  return (
    <View style={[styles.imageSlide, { width: SLIDE_WIDTH, height }]}>
      <Image
        source={imageUri}
        style={styles.mainImage}
        contentFit="contain"
        transition={index === 0 ? 0 : 50}
        placeholder={blurhash}
        cachePolicy="memory-disk"
        priority={index <= 1 ? 'high' : 'low'}
        recyclingKey={`${imageUri}-${index}`}
      />
    </View>
  );
});

type ThumbProps = { uri: string; index: number; selected: boolean; onPress: () => void; isLast: boolean };

const ThumbnailCell = React.memo(function ThumbnailCell({
  uri,
  index,
  selected,
  onPress,
  isLast,
}: ThumbProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.thumbnail, !isLast && styles.thumbnailSpacing, selected && styles.thumbnailSelected]}
      activeOpacity={0.8}
    >
      <Image
        source={uri}
        style={styles.thumbnailImage}
        contentFit="cover"
        transition={0}
        placeholder={blurhash}
        placeholderContentFit="cover"
        cachePolicy="memory-disk"
        priority={index < 8 ? 'high' : 'normal'}
        recyclingKey={`thumb-${uri}-${index}`}
        allowDownscaling
      />
      {selected ? <View style={styles.thumbnailOverlay} /> : null}
    </TouchableOpacity>
  );
});

function ProductGalleryComponent({ images = [] }: ProductGalleryProps) {
  const { t } = useTranslation();
  const [selectedImage, setSelectedImage] = useState(0);
  const listRef = useRef<FlatList<string>>(null);

  const processedImages = useMemo(() => {
    const cleaned = images.map(cleanFirebaseUrl);
    return cleaned.length > 0 ? cleaned : ['https://via.placeholder.com/400'];
  }, [images]);

  const mainHeight = SLIDE_WIDTH * MAIN_IMAGE_RATIO;

  const getItemLayout = useCallback(
    (_: ArrayLike<string> | null | undefined, index: number) => ({
      length: SLIDE_WIDTH,
      offset: SLIDE_WIDTH * index,
      index,
    }),
    []
  );

  const syncIndexFromOffset = useCallback(
    (x: number) => {
      const idx = Math.round(x / SLIDE_WIDTH);
      setSelectedImage((prev) => {
        if (idx === prev || idx < 0 || idx >= processedImages.length) return prev;
        return idx;
      });
    },
    [processedImages.length]
  );

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      syncIndexFromOffset(e.nativeEvent.contentOffset.x);
    },
    [syncIndexFromOffset]
  );

  const scrollToImage = useCallback(
    (index: number) => {
      if (index < 0 || index >= processedImages.length) return;
      listRef.current?.scrollToIndex({ index, animated: true });
      setSelectedImage(index);
    },
    [processedImages.length]
  );

  const renderSlide = useCallback(
    ({ item, index }: { item: string; index: number }) => (
      <GallerySlide imageUri={item} index={index} height={mainHeight} />
    ),
    [mainHeight]
  );

  const keyExtractor = useCallback((item: string, index: number) => `${item}-${index}`, []);

  /**
   * Précharge les URLs « hors première slide » (miniatures) : lot prioritaire très tôt,
   * puis le reste pour ne pas saturer le réseau d’un coup.
   */
  useEffect(() => {
    if (processedImages.length <= 1) return;

    let cancelled = false;
    const prefetchOpts = { cachePolicy: 'memory-disk' as const };
    const rest = processedImages.slice(1);

    const idFast = setTimeout(() => {
      if (cancelled || !rest.length) return;
      const batchA = rest.slice(0, 8);
      Image.prefetch(batchA.length === 1 ? batchA[0] : batchA, prefetchOpts).catch(() => {});
    }, 8);

    const idRest = setTimeout(() => {
      if (cancelled || rest.length <= 8) return;
      const batchB = rest.slice(8);
      Image.prefetch(batchB.length === 1 ? batchB[0] : batchB, prefetchOpts).catch(() => {});
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(idFast);
      clearTimeout(idRest);
    };
  }, [processedImages]);

  const thumbCount = processedImages.length;

  const renderThumb = useCallback(
    ({ item, index }: { item: string; index: number }) => (
      <ThumbnailCell
        uri={item}
        index={index}
        selected={selectedImage === index}
        onPress={() => scrollToImage(index)}
        isLast={index === thumbCount - 1}
      />
    ),
    [selectedImage, scrollToImage, thumbCount]
  );

  return (
    <View style={styles.container}>
      <View style={[styles.mainImageContainer, { height: mainHeight }]}>
        <FlatList
          ref={listRef}
          data={processedImages}
          renderItem={renderSlide}
          keyExtractor={keyExtractor}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          getItemLayout={getItemLayout}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews
          decelerationRate="fast"
          scrollEventThrottle={64}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onScrollToIndexFailed={({ index }) => {
            listRef.current?.scrollToOffset({
              offset: index * SLIDE_WIDTH,
              animated: true,
            });
          }}
          updateCellsBatchingPeriod={50}
        />

        {processedImages.length > 1 && (
          <View style={styles.imageCounter}>
            <Ionicons name="images-outline" size={12} color="#FFF" style={{ marginRight: 4 }} />
            <Text style={styles.imageCounterText}>
              {selectedImage + 1} / {processedImages.length}
            </Text>
          </View>
        )}

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
              onPress={() =>
                scrollToImage(Math.min(processedImages.length - 1, selectedImage + 1))
              }
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

      {processedImages.length > 1 && (
        <View style={styles.paginationContainer}>
          {processedImages.map((_, index) => (
            <TouchableOpacity
              key={`dot-${index}`}
              onPress={() => scrollToImage(index)}
              accessibilityRole="button"
              accessibilityLabel={t('productGallery.goToImage', {
                index: index + 1,
                total: processedImages.length,
              })}
              accessibilityState={{ selected: selectedImage === index }}
              style={[styles.paginationDot, selectedImage === index && styles.paginationDotActive]}
            />
          ))}
        </View>
      )}

      {processedImages.length > 1 && (
        <FlatList
          data={processedImages}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.thumbnailsContainer}
          contentContainerStyle={styles.thumbnailsContent}
          keyExtractor={keyExtractor}
          renderItem={renderThumb}
          initialNumToRender={Math.min(processedImages.length, 14)}
          maxToRenderPerBatch={14}
          windowSize={5}
          removeClippedSubviews={false}
          updateCellsBatchingPeriod={25}
        />
      )}
    </View>
  );
}

export default React.memo(ProductGalleryComponent);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    marginHorizontal: H_MARGIN,
    marginTop: 8,
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
    position: 'relative',
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    overflow: 'hidden',
  },

  imageSlide: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  mainImage: {
    width: '100%',
    height: '100%',
  },

  imageCounter: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.72)',
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

  navButtonLeft: { left: 8 },
  navButtonRight: { right: 8 },

  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
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
    maxHeight: 88,
  },

  thumbnailsContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  thumbnail: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
    backgroundColor: '#FAFAFA',
  },

  thumbnailSpacing: {
    marginRight: THUMB_GAP,
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
});
