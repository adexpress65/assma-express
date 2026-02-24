import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function FloatingAIButton() {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const bounceAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: 1.1, duration: 1500, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isExpanded ? 1 : 0,
      friction: 5,
      useNativeDriver: true,
    }).start();
  }, [isExpanded]);

  const quickActions = [
    { icon: 'sparkles', label: 'Assistant IA', color: '#8E24AA', path: '/ai-assistant' },
    { icon: 'search', label: 'Recherche IA', color: '#2196F3', path: '/ai-search' },
    { icon: 'cart', label: 'Panier', color: '#ff6a00', path: '/cart' },
  ];

  const handleNavigate = (path: string) => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;

    console.log("🚀 Navigation :", path);

    setIsExpanded(false);
    router.push(path as any);

    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 700);
  };

  const actionOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={styles.container} pointerEvents="box-none">

      {/* Overlay */}
      {isExpanded && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setIsExpanded(false)}
        />
      )}

      {/* Quick Actions */}
      {quickActions.map((action, index) => (
        <Animated.View
          key={action.icon}
          pointerEvents={isExpanded ? "auto" : "none"}
          style={[
            styles.quickAction,
            {
              opacity: actionOpacity,
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -85 * (index + 1)],
                  }),
                },
                { scale: actionOpacity },
              ],
            },
          ]}
        >
          <View style={styles.labelContainer}>
            <Text style={styles.actionLabel}>{action.label}</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.actionButton, { backgroundColor: action.color }]}
            onPress={() => handleNavigate(action.path)}
          >
            <Ionicons name={action.icon as any} size={22} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      ))}

      {/* Bouton principal */}
      <Animated.View style={{ transform: [{ scale: bounceAnim }] }}>
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.buttonGradientContainer}
          onPress={() => setIsExpanded(prev => !prev)}
        >
          <LinearGradient
            colors={['#8E24AA', '#1E88E5']}
            style={styles.buttonGradient}
          >
            <Ionicons name={isExpanded ? "close" : "sparkles"} size={28} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    alignItems: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  overlay: {
    position: 'absolute',
    width: width,
    height: height,
    bottom: -30,
    right: -20,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  buttonGradientContainer: {
    borderRadius: 35,
    overflow: 'hidden',
    elevation: 10,
  },
  buttonGradient: {
    width: 65,
    height: 65,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickAction: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 100000,
  },
  actionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
  labelContainer: {
    position: 'absolute',
    right: 60,
    width: 110,
    alignItems: 'flex-end',
  },
  actionLabel: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: 'bold',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
