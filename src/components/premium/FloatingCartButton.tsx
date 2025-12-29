// src/components/premium/FloatingCartButton.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function FloatingCartButton() {
  const router = useRouter();
  const [cartCount, setCartCount] = useState(3);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(bounceAnim, {
        toValue: 1.2,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(bounceAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [isExpanded]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    if (isExpanded) {
      router.push('/cart');
    } else {
      setIsExpanded(true);
    }
  };

  const handleLongPress = () => {
    Animated.timing(rotateAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      rotateAnim.setValue(0);
    });

    Alert.alert(
      'Panier Rapide',
      `Vous avez ${cartCount} articles dans votre panier. Total: 245 000 FCFA`,
      [
        { text: 'Voir le panier', onPress: () => router.push('/cart') },
        { text: 'Continuer', style: 'cancel' },
      ]
    );
  };

  const quickActions = [
    {
      icon: 'search',
      label: 'Rechercher',
      color: '#2196F3',
      onPress: () => router.push('/search'),
    },
    {
      icon: 'heart',
      label: 'Favoris',
      color: '#FF4444',
      onPress: () => router.push('/favorites'),
    },
    {
      icon: 'chatbubble',
      label: 'Support',
      color: '#4CAF50',
      onPress: () => router.push('/support'),
    },
    {
      icon: 'person',
      label: 'Compte',
      color: '#9C27B0',
      onPress: () => router.push('/profile'),
    },
  ];

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const actionTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -80],
  });

  const actionOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={styles.container}>
      {quickActions.map((action, index) => (
        <Animated.View
          key={action.icon}
          style={[
            styles.quickAction,
            {
              transform: [
                { 
                  translateY: actionTranslateY.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -80 * (index + 1)]
                  }) 
                },
                { scale: actionOpacity },
              ],
              opacity: actionOpacity,
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: action.color }]}
            onPress={action.onPress}
          >
            <Ionicons name={action.icon as any} size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.actionLabel}>{action.label}</Text>
        </Animated.View>
      ))}

      <Animated.View
        style={[
          styles.floatingButton,
          {
            transform: [
              { scale: Animated.multiply(scaleAnim, bounceAnim) },
              { rotate: rotation },
            ],
          },
        ]}
      >
        <TouchableOpacity
          onPress={handlePress}
          onLongPress={handleLongPress}
          activeOpacity={0.8}
          style={styles.buttonTouchable}
        >
          <LinearGradient
            colors={['#ff6a00', '#ff8c00']}
            style={styles.buttonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="cart" size={24} color="#fff" />
            
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>
                  {cartCount > 99 ? '99+' : cartCount}
                </Text>
              </View>
            )}

            <Animated.View 
              style={[
                styles.expandIndicator,
                {
                  transform: [{
                    rotate: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '180deg']
                    })
                  }]
                }
              ]}
            >
              <Ionicons name="chevron-up" size={12} color="#fff" />
            </Animated.View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {isExpanded && (
        <TouchableOpacity
          style={styles.overlay}
          onPress={() => setIsExpanded(false)}
          activeOpacity={1}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    alignItems: 'center',
    zIndex: 1000,
  },
  floatingButton: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  buttonTouchable: {
    borderRadius: 30,
    overflow: 'hidden',
  },
  buttonGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FF4444',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  expandIndicator: {
    position: 'absolute',
    bottom: 6,
  },
  quickAction: {
    position: 'absolute',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  actionLabel: {
    marginTop: 4,
    fontSize: 10,
    color: '#666',
    fontWeight: '600',
  },
  overlay: {
    position: 'absolute',
    top: -Dimensions.get('window').height,
    left: -Dimensions.get('window').width,
    width: Dimensions.get('window').width * 3,
    height: Dimensions.get('window').height * 3,
    backgroundColor: 'transparent',
  },
});