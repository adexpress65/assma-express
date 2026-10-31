import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/constants/Theme';
import type { AuthGuardReason } from '@/types/authGuard';

type AuthRequiredModalProps = {
  visible: boolean;
  reason: AuthGuardReason;
  message?: string;
  onClose: () => void;
  onSignIn: () => void;
  onRegister: () => void;
};

export default function AuthRequiredModal({
  visible,
  reason,
  message,
  onClose,
  onSignIn,
  onRegister,
}: AuthRequiredModalProps) {
  const { t } = useTranslation();

  const title = t(`app.authGuard.reasons.${reason}.title`, {
    defaultValue: t('app.authGuard.title'),
  });
  const body =
    message ||
    t(`app.authGuard.reasons.${reason}.message`, {
      defaultValue: t('app.authGuard.defaultMessage'),
    });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={['#FFF5EC', '#FFFFFF']}
            style={styles.cardInner}
          >
            <View style={styles.iconWrap}>
              <LinearGradient
                colors={COLORS.primaryGradient}
                style={styles.iconCircle}
              >
                <Ionicons name="lock-closed" size={28} color="#FFF" />
              </LinearGradient>
            </View>

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{body}</Text>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={onSignIn}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={COLORS.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryGradient}
              >
                <Ionicons name="log-in-outline" size={20} color="#FFF" />
                <Text style={styles.primaryText}>{t('app.authGuard.signIn')}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={onRegister}
              activeOpacity={0.85}
            >
              <Ionicons name="person-add-outline" size={18} color={COLORS.primary} />
              <Text style={styles.secondaryText}>{t('app.authGuard.register')}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.laterBtn}>
              <Text style={styles.laterText}>{t('app.authGuard.later')}</Text>
            </TouchableOpacity>
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 16,
  },
  cardInner: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
  },
  iconWrap: {
    marginBottom: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 22,
  },
  primaryBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
  },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  primaryText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
    marginBottom: 8,
  },
  secondaryText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  laterBtn: {
    paddingVertical: 8,
  },
  laterText: {
    color: COLORS.textLight,
    fontSize: 13,
    fontWeight: '600',
  },
});
