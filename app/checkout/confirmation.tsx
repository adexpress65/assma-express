// apps/mobile/app/checkout/confirmation.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

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
  // Tous les hooks sont appelés inconditionnellement
  const router = useRouter();
  const params = useLocalSearchParams();

  // Récupération du statut (sans condition)
  const status = params.status as string | undefined;

  // Détermination de l'état du paiement
  const isSuccess = status === 'success';
  const isCancel = status === 'cancel';
  const isValidStatus = isSuccess || isCancel;

  // Configuration de l'affichage selon le statut
  const getStatusConfig = () => {
    if (isSuccess) {
      return {
        title: 'Paiement simulé réussi',
        message: 'Votre paiement de test a été traité avec succès en mode sandbox.',
        icon: 'checkmark-circle' as const,
        iconColor: COLORS.success,
        bgColor: '#E8F7EF',
        borderColor: COLORS.success,
      };
    }

    if (isCancel) {
      return {
        title: 'Paiement annulé',
        message: 'Vous avez annulé le processus de paiement.',
        icon: 'close-circle' as const,
        iconColor: COLORS.error,
        bgColor: '#FCE8E6',
        borderColor: COLORS.error,
      };
    }

    // Par défaut (statut invalide ou manquant)
    return {
      title: 'Statut inconnu',
      message: 'Impossible de déterminer le résultat du paiement.',
      icon: 'help-circle' as const,
      iconColor: COLORS.textLight,
      bgColor: '#F0F0F0',
      borderColor: COLORS.textLight,
    };
  };

  const config = getStatusConfig();

  // Handler pour le bouton - navigation UNIQUEMENT au clic
  const handleReturnHome = () => {
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Icône */}
        <View style={styles.iconContainer}>
          <Ionicons
            name={config.icon}
            size={100}
            color={config.iconColor}
          />
        </View>

        {/* Titre */}
        <Text style={styles.title}>{config.title}</Text>

        {/* Message */}
        <View style={[
          styles.messageCard,
          {
            backgroundColor: config.bgColor,
            borderLeftColor: config.borderColor,
          }
        ]}>
          <Text style={styles.messageText}>{config.message}</Text>
        </View>

        {/* Informations supplémentaires */}
        {isValidStatus && (
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
              <Text style={styles.infoText}>
                {isSuccess 
                  ? 'Cette transaction a été effectuée en mode test.'
                  : 'Vous pouvez réessayer quand vous le souhaitez.'
                }
              </Text>
            </View>
            
            {status && (
              <View style={styles.infoRow}>
                <Ionicons name="code-slash" size={20} color={COLORS.textLight} />
                <Text style={styles.codeText}>Status: {status}</Text>
              </View>
            )}
          </View>
        )}

        {/* Bouton */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleReturnHome}
        >
          <Ionicons name="home" size={22} color={COLORS.white} />
          <Text style={styles.buttonText}>Retour à l'accueil</Text>
        </TouchableOpacity>

        {/* Note technique */}
        {isSuccess && (
          <Text style={styles.note}>
            ℹ️ En production, vous recevrez une confirmation par email.
          </Text>
        )}
      </View>
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
    marginBottom: 32,
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  messageCard: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    marginBottom: 24,
  },
  messageText: {
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 24,
    textAlign: 'center',
  },
  infoCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  codeText: {
    marginLeft: 12,
    fontSize: 13,
    color: COLORS.textLight,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    maxWidth: 300,
    gap: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '600',
  },
  note: {
    marginTop: 24,
    fontSize: 13,
    color: COLORS.textLight,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});