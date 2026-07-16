import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, StyleSheet, View } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function usePulse() {
  const opacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 650,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return opacity;
}

/** Rails type carrousel : cartes horizontales factices */
export function CarouselSectionSkeleton({
  cardWidthRatio = 0.72,
}: {
  cardWidthRatio?: number;
}) {
  const opacity = usePulse();
  const cardW = SCREEN_WIDTH * cardWidthRatio;
  return (
    <View style={styles.carouselBlock}>
      <Animated.View style={[styles.titleBar, { opacity }]} />
      <View style={styles.carouselRow}>
        {[0, 1, 2].map((i) => (
          <Animated.View
            key={i}
            style={[
              styles.carouselCard,
              { width: cardW, opacity },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

/** Grille 2 colonnes (section « Nouveautés » etc.) */
export function ProductGridSkeleton({ rows = 2 }: { rows?: number }) {
  const opacity = usePulse();
  const cells = rows * 2;
  return (
    <View style={styles.grid}>
      {Array.from({ length: cells }).map((_, i) => (
        <Animated.View key={i} style={[styles.gridCell, { opacity }]}>
          <Animated.View style={[styles.gridImage, { opacity }]} />
          <Animated.View style={[styles.gridLineShort, { opacity }]} />
          <Animated.View style={[styles.gridLineLong, { opacity }]} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  carouselBlock: {
    marginVertical: 16,
    paddingLeft: 16,
  },
  titleBar: {
    height: 22,
    width: 160,
    borderRadius: 6,
    backgroundColor: "#ececec",
    marginBottom: 14,
  },
  carouselRow: {
    flexDirection: "row",
    gap: 12,
  },
  carouselCard: {
    height: 220,
    borderRadius: 14,
    backgroundColor: "#ececec",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 4,
  },
  gridCell: {
    width: "48.5%",
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    overflow: "hidden",
    marginBottom: 4,
  },
  gridImage: {
    height: 160,
    backgroundColor: "#ececec",
  },
  gridLineShort: {
    marginTop: 10,
    marginHorizontal: 10,
    height: 12,
    width: "45%",
    borderRadius: 4,
    backgroundColor: "#ececec",
  },
  gridLineLong: {
    marginTop: 8,
    marginHorizontal: 10,
    marginBottom: 12,
    height: 12,
    width: "70%",
    borderRadius: 4,
    backgroundColor: "#ececec",
  },
});
