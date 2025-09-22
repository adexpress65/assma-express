import React from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '../theme/colors';

const { width } = Dimensions.get('window');

interface CarouselBannerProps {
  title: string;
  subtitle: string;
  onCouponsPress?: () => void;
}

const CarouselBanner: React.FC<CarouselBannerProps> = ({
  title,
  subtitle,
  onCouponsPress,
}) => {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FFB74D', '#FFA000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.textContainer}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <Pressable style={styles.couponButton} onPress={onCouponsPress}>
            <Text style={styles.couponButtonText}>Mes coupons</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradient: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    color: '#4E342E',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#4E342E',
    opacity: 0.8,
    marginTop: 6,
    textAlign: 'center',
  },
  couponButton: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  couponButtonText: {
    color: '#4E342E',
    fontWeight: '700',
  },
});

export default React.memo(CarouselBanner);