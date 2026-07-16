import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
  BackHandler,
  Platform
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics'; // Optionnel: nécessite expo-haptics

const COLORS = {
  primary: '#FF6A00',
  white: '#FFFFFF',
  success: '#28A745',
  error: '#DC3545',
  text: '#2D3748',
  textLight: '#718096',
  background: '#f8f9fa',
};

export default function ConfirmationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const status = params.status as string | undefined;
  const orderId = params.orderId as string | undefined; // Récupéré de la WebView
  
  const isSuccess = status === 'success';
  const isCancel = status === 'cancel';
  const isValidStatus = isSuccess || isCancel;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  // Bloquer le retour arrière physique sur Android
  useEffect(() => {
    const backAction = () => {
      handleReturnHome();
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, []);

  const getStatusConfig = () => {
    if (isSuccess) {
      return {
        title: 'Paiement réussi',
        message: 'Votre commande a été payée avec succès. Merci pour votre confiance.',
        icon: 'checkmark-circle' as const,
        iconColor: COLORS.success,
        bgColor: '#E8F7EF',
        borderColor: COLORS.success,
      };
    }

    if (isCancel) {
      return {
        title: 'Paiement en vérification',
        message: 'Votre transaction a été reçue et est en cours de confirmation bancaire. Si vous avez été débité, la commande sera mise à jour automatiquement.',
        icon: 'alert-circle' as const,
        iconColor: COLORS.error,
        bgColor: '#FCE8E6',
        borderColor: COLORS.error,
      };
    }

    return {
      title: 'Vérification en cours',
      message: 'Nous traitons la réponse de la banque. Veuillez vérifier vos emails.',
      icon: 'time' as const,
      iconColor: COLORS.textLight,
      bgColor: '#F0F0F0',
      borderColor: COLORS.textLight,
    };
  };

  const config = getStatusConfig();

  useEffect(() => {
    // Déclenchement des vibrations haptiques
    if (isSuccess) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (isCancel) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleReturnHome = () => {
    if (isSuccess) {
      router.replace('/orders');
      return;
    }
    router.replace('/orders');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.iconContainer,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Ionicons name={config.icon} size={110} color={config.iconColor} />
        </Animated.View>

        <Text style={styles.title}>{config.title}</Text>

        <View style={[styles.messageCard, { backgroundColor: config.bgColor, borderLeftColor: config.borderColor }]}>
          <Text style={styles.messageText}>{config.message}</Text>
        </View>

        <View style={styles.infoCard}>
          {orderId && (
             <View style={styles.orderRefContainer}>
                <Text style={styles.orderRefLabel}>Référence commande</Text>
                <Text style={styles.orderRefValue}>{orderId}</Text>
             </View>
          )}

          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
            <Text style={styles.infoText}>
              {isSuccess
                ? 'Le récapitulatif est disponible dans l’onglet "Mes Commandes".'
                : 'Si le débit est effectué, la commande apparaîtra dans "Mes Commandes" après synchronisation.'
              }
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.button, !isSuccess && { backgroundColor: COLORS.text }]} 
          onPress={handleReturnHome}
        >
          <Ionicons
            name={isSuccess ? "receipt-outline" : "refresh"}
            size={22}
            color={COLORS.white}
          />
          <Text style={styles.buttonText}>
            {isSuccess ? "Voir mes commandes" : "Suivre ma commande"}
          </Text>
        </TouchableOpacity>

        {!isSuccess && (
           <TouchableOpacity 
             style={styles.secondaryButton} 
             onPress={() => router.push('/support')}
           >
             <Text style={styles.secondaryButtonText}>Contacter le support</Text>
           </TouchableOpacity>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 20,
    padding: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  messageCard: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    borderLeftWidth: 5,
    marginBottom: 24,
    backgroundColor: COLORS.white,
    // Shadow
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  messageText: {
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 24,
    textAlign: 'center',
    fontWeight: '500'
  },
  infoCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  orderRefContainer: {
    alignItems: 'center',
    paddingBottom: 15,
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  orderRefLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  orderRefValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 13,
    color: COLORS.textLight,
    lineHeight: 18,
  },
  button: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    width: '100%',
    gap: 12,
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 20,
    padding: 10,
  },
  secondaryButtonText: {
    color: COLORS.textLight,
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline'
  }
});
