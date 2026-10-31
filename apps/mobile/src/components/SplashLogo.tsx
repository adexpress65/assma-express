import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Mask, Path, Rect } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Logo ~22 % de la largeur, carré, coins ~25 % du côté. */
const LOGO_SIZE = SCREEN_WIDTH * 0.22;
const LOGO_RADIUS = LOGO_SIZE * 0.25;
const LETTER_SIZE = LOGO_SIZE * 0.46;

/** Trait le plus large de la composition (~73,5 % de l’écran). */
const SWOOSH_WIDTH = SCREEN_WIDTH * 0.735;

/**
 * Silhouette pleine du paraphe original (vectorisée depuis la photo).
 * Ce n’est plus un stroke d’épaisseur constante : l’épaisseur variable,
 * la boucle à droite, le retour fin et le point font partie de la forme.
 */
export const SWOOSH_PATH =
  'M 16.3 19.4 L 18.9 16.9 L 25.2 15.6 L 83.5 11.8 L 210.1 13.1 L 322.9 20.6 L 374.8 28.2 L 381.1 29.5 L 383.7 32.0 L 382.4 37.1 L 205.1 35.8 L 184.8 38.3 L 177.2 42.1 L 179.7 44.7 L 210.1 57.3 L 211.4 59.8 L 219.0 58.6 L 220.3 64.9 L 217.7 67.4 L 212.7 67.4 L 210.1 61.1 L 202.5 59.8 L 177.2 48.5 L 173.4 44.7 L 173.4 38.3 L 177.2 35.8 L 210.1 32.0 L 359.6 33.3 L 359.6 30.8 L 298.8 24.4 L 229.1 20.6 L 117.7 20.6 L 40.4 25.7 L 17.6 25.7 L 16.3 20.6 Z';

/** Axe du geste d’écriture : gauche → droite, boucle, retour, point. */
const SWOOSH_WRITE =
  'M 18 21.2 C 70 17.2, 140 15.6, 210 17.8 C 280 20.4, 340 28.2, 378 33.2 C 381 34.6, 372 36.4, 330 36.2 C 270 35.8, 210 36.8, 178 42 C 182 50, 200 58.2, 216 65.5';

export const SWOOSH_LENGTH = 640;

/** Durée plancher alignée sur logo + texte + trait + pause finale. */
export const SPLASH_MIN_DISPLAY_MS = 3200;

const SWOOSH_VIEWBOX_W = 400;
const SWOOSH_VIEWBOX_H = 83;
const SWOOSH_HEIGHT = (SWOOSH_WIDTH * SWOOSH_VIEWBOX_H) / SWOOSH_VIEWBOX_W;

type SplashLogoProps = {
  onAnimationComplete?: () => void;
};

export default function SplashLogo({ onAnimationComplete }: SplashLogoProps) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.92)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslate = useRef(new Animated.Value(8)).current;
  const dashOffset = useRef(new Animated.Value(SWOOSH_LENGTH)).current;
  const revealWidth = useRef(new Animated.Value(0)).current;
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onAnimationComplete);
  onCompleteRef.current = onAnimationComplete;

  useEffect(() => {
    const sequence = Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 7,
          tension: 80,
          useNativeDriver: false,
        }),
      ]),
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(textTranslate, {
          toValue: 0,
          duration: 450,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
      Animated.parallel([
        Animated.timing(dashOffset, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(revealWidth, {
          toValue: SWOOSH_WIDTH,
          duration: 1100,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
      Animated.delay(700),
    ]);

    sequence.start(({ finished }) => {
      if (!finished || completedRef.current) return;
      completedRef.current = true;
      onCompleteRef.current?.();
    });

    return () => {
      sequence.stop();
    };
  }, [dashOffset, logoOpacity, logoScale, revealWidth, textOpacity, textTranslate]);

  return (
    <View style={styles.root} accessibilityRole="image" accessibilityLabel="A2Express">
      <Animated.View
        style={[
          styles.logoBox,
          {
            width: LOGO_SIZE,
            height: LOGO_SIZE,
            borderRadius: LOGO_RADIUS,
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <LinearGradient
          colors={['#FF9A3D', '#FF6A00']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.logoFill, { borderRadius: LOGO_RADIUS }]}
        >
          <Text style={styles.logoLetter}>a</Text>
        </LinearGradient>
      </Animated.View>

      <Animated.View
        style={{
          opacity: textOpacity,
          transform: [{ translateY: textTranslate }],
          alignItems: 'center',
        }}
      >
        <Text style={styles.tagline}>厂家直销，价格最优，极速物流</Text>
        <View style={styles.swooshWrap}>
          {Platform.OS === 'android' ? (
            <Animated.View
              style={{ width: revealWidth, height: SWOOSH_HEIGHT, overflow: 'hidden' }}
            >
              <Svg
                width={SWOOSH_WIDTH}
                height={SWOOSH_HEIGHT}
                viewBox={`0 0 ${SWOOSH_VIEWBOX_W} ${SWOOSH_VIEWBOX_H}`}
              >
                <Path d={SWOOSH_PATH} fill="#000000" />
              </Svg>
            </Animated.View>
          ) : (
            <Svg
              width={SWOOSH_WIDTH}
              height={SWOOSH_HEIGHT}
              viewBox={`0 0 ${SWOOSH_VIEWBOX_W} ${SWOOSH_VIEWBOX_H}`}
            >
              <Defs>
                <Mask
                  id="swooshDraw"
                  x="-12"
                  y="-12"
                  width={SWOOSH_VIEWBOX_W + 24}
                  height={SWOOSH_VIEWBOX_H + 24}
                  maskUnits="userSpaceOnUse"
                >
                  <Rect
                    x="-12"
                    y="-12"
                    width={SWOOSH_VIEWBOX_W + 24}
                    height={SWOOSH_VIEWBOX_H + 24}
                    fill="#000000"
                  />
                  <AnimatedPath
                    d={SWOOSH_WRITE}
                    stroke="#FFFFFF"
                    strokeWidth={26}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    strokeDasharray={`${SWOOSH_LENGTH}, ${SWOOSH_LENGTH}`}
                    strokeDashoffset={dashOffset}
                  />
                </Mask>
              </Defs>
              <Path d={SWOOSH_PATH} fill="#000000" mask="url(#swooshDraw)" />
            </Svg>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBox: {
    overflow: 'hidden',
    marginBottom: SCREEN_WIDTH * 0.05,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 5 },
      },
      android: {
        elevation: 0,
      },
    }),
  },
  logoFill: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    color: '#002147',
    fontSize: LETTER_SIZE,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    includeFontPadding: false,
    textAlign: 'center',
    lineHeight: LETTER_SIZE * 1.05,
    marginTop: -LETTER_SIZE * 0.04,
  },
  tagline: {
    color: '#000000',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0.4,
    textAlign: 'center',
    marginBottom: SCREEN_WIDTH * 0.018,
  },
  swooshWrap: {
    width: SWOOSH_WIDTH,
    height: SWOOSH_HEIGHT,
    alignItems: 'flex-start',
    overflow: 'hidden',
  },
});
