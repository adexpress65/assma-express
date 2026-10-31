import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { 
  sendPasswordResetEmail,
  UserCredential,
  GoogleAuthProvider,
  signInWithCredential,
  OAuthProvider
} from 'firebase/auth';
import { auth } from '../../config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { getUserDisplayLabel } from '@/utils/userIdentity';
import {
  DEFAULT_PHONE_COUNTRY,
  formatE164ForDisplay,
  isValidE164,
  PHONE_COUNTRIES,
  toE164,
  type PhoneCountry,
} from '@/utils/phoneE164';
import {
  FirebaseRecaptchaVerifierModal,
  isRecaptchaCancelled,
  type FirebaseRecaptchaVerifierRef,
} from '@/components/auth/FirebaseRecaptchaVerifierModal';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';

WebBrowser.maybeCompleteAuthSession();

interface LoginModalProps {
  visible: boolean;
  onClose: () => void;
  onLoginSuccess?: () => void;
  /** Message contextuel (ex. action bloquée en mode invité). */
  infoMessage?: string;
  initialMode?: 'login' | 'register';
}

type FirebaseError = {
  code: string;
  message: string;
};

const ERROR_MESSAGES = {
  INVALID_EMAIL: {
    title: 'Email invalide',
    message: 'L\'adresse email n\'est pas valide.'
  },
  EMAIL_ALREADY_IN_USE: {
    title: 'Email déjà utilisé',
    message: 'Cette adresse email est déjà associée à un compte.'
  },
  USER_NOT_FOUND: {
    title: 'Compte introuvable',
    message: 'Aucun compte trouvé avec cette adresse email.'
  },
  WRONG_PASSWORD: {
    title: 'Mot de passe incorrect',
    message: 'Le mot de passe saisi est incorrect.'
  },
  WEAK_PASSWORD: {
    title: 'Mot de passe faible',
    message: 'Le mot de passe doit contenir au moins 6 caractères.'
  },
  INVALID_PHONE: {
    title: 'Numéro invalide',
    message: 'Saisissez un numéro valide avec l’indicatif pays.'
  },
  INVALID_OTP: {
    title: 'Code incorrect',
    message: 'Le code SMS à 6 chiffres est invalide ou a expiré.'
  },
  SMS_BLOCKED: {
    title: 'SMS indisponible',
    message:
      'Firebase a refusé l’envoi du SMS (quota, protection anti-abus ou pays non desservi). Utilisez un numéro de test dans Authentication > Sign-in method > Phone, ou réessayez plus tard.',
  },
  DEFAULT: {
    title: 'Erreur',
    message: 'Une erreur est survenue. Veuillez réessayer.'
  }
} as const;

const OTP_COOLDOWN_SECONDS = 60;

const isSmsBlockedError = (error: { code?: string; message?: string }): boolean => {
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '');
  return (
    code === 'auth/error-code:-39' ||
    /error-code:-39/i.test(code) ||
    /error-code:-39/i.test(message) ||
    /error code:\s*-?39/i.test(message)
  );
};

const getFirebaseErrorMessage = (error: FirebaseError): { title: string; message: string } => {
  const { code, message } = error;

  if (isSmsBlockedError(error)) {
    return ERROR_MESSAGES.SMS_BLOCKED;
  }

  switch (code) {
    case 'auth/email-already-in-use':
      return ERROR_MESSAGES.EMAIL_ALREADY_IN_USE;
    case 'auth/invalid-email':
      return ERROR_MESSAGES.INVALID_EMAIL;
    case 'auth/user-not-found':
      return ERROR_MESSAGES.USER_NOT_FOUND;
    case 'auth/wrong-password':
      return ERROR_MESSAGES.WRONG_PASSWORD;
    case 'auth/invalid-credential':
      return ERROR_MESSAGES.WRONG_PASSWORD;
    case 'auth/weak-password':
      return ERROR_MESSAGES.WEAK_PASSWORD;
    case 'auth/network-request-failed':
      return { title: 'Erreur réseau', message: 'Vérifiez votre connexion internet.' };
    case 'auth/too-many-requests':
      return { title: 'Trop de tentatives', message: 'Veuillez réessayer dans quelques minutes.' };
    case 'auth/invalid-phone-number':
    case 'auth/missing-phone-number':
      return ERROR_MESSAGES.INVALID_PHONE;
    case 'auth/invalid-verification-code':
    case 'auth/invalid-verification-id':
    case 'auth/missing-verification-code':
    case 'auth/code-expired':
    case 'auth/session-expired':
      return ERROR_MESSAGES.INVALID_OTP;
    case 'auth/captcha-check-failed':
      return { title: 'Vérification', message: 'La vérification de sécurité a échoué. Réessayez.' };
    case 'auth/quota-exceeded':
      return { title: 'SMS indisponible', message: 'Quota SMS atteint. Réessayez plus tard.' };
    default:
      console.warn('Code d\'erreur Firebase non géré:', code, message);
      return { title: ERROR_MESSAGES.DEFAULT.title, message: message || ERROR_MESSAGES.DEFAULT.message };
  }
};

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export default function LoginModal({
  visible,
  onClose,
  onLoginSuccess,
  infoMessage,
  initialMode = 'login',
}: LoginModalProps) {
  const { login, register, sendPhoneCode, confirmPhoneCode, completePhoneProfile, clearPhoneChallenge } = useAuth();
  const recaptchaRef = useRef<FirebaseRecaptchaVerifierRef>(null);
  const [isLogin, setIsLogin] = useState<boolean>(initialMode !== 'register');
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [phoneStep, setPhoneStep] = useState<'number' | 'otp' | 'profile'>('number');
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountry>(DEFAULT_PHONE_COUNTRY);
  const [phoneLocal, setPhoneLocal] = useState('');
  const [phoneE164, setPhoneE164] = useState('');
  const [phoneFullName, setPhoneFullName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState<boolean>(false);
  const [slideAnim] = useState<Animated.Value>(new Animated.Value(0));

  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    expoClientId: 'VOTRE_CLIENT_ID_EXPO_GOOGLE',
    iosClientId: '251188713496-btdeegjjniu9f8t21j1c6bf1r2pi8er.apps.googleusercontent.com',
    androidClientId: 'VOTRE_CLIENT_ID_ANDROID_GOOGLE',
    webClientId: 'VOTRE_CLIENT_ID_WEB_GOOGLE',
  });

  React.useEffect(() => {
    if (visible) {
      setIsLogin(initialMode !== 'register');
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible, slideAnim, initialMode]);

  React.useEffect(() => {
    if (googleResponse?.type === 'success') {
      handleGoogleSignIn(googleResponse.authentication?.accessToken);
    }
  }, [googleResponse]);

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const id = setTimeout(() => setOtpCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [otpCooldown]);

  const slideUp = {
    transform: [{
      translateY: slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [50, 0]
      })
    }],
    opacity: slideAnim
  };

  const resetForm = (): void => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setLoading(false);
    setSocialLoading(null);
    setForgotPasswordMode(false);
    setAuthMethod('email');
    setPhoneStep('number');
    setPhoneCountry(DEFAULT_PHONE_COUNTRY);
    setPhoneLocal('');
    setPhoneE164('');
    setPhoneFullName('');
    setOtpCode('');
    setOtpCooldown(0);
    setCountryPickerVisible(false);
    clearPhoneChallenge();
  };

  const validateForm = (): boolean => {
    if (!validateEmail(email)) {
      Alert.alert('Email invalide', 'Veuillez saisir une adresse email valide');
      return false;
    }

    if (password.length < 6) {
      Alert.alert('Mot de passe trop court', 'Le mot de passe doit contenir au moins 6 caractères');
      return false;
    }

    if (!isLogin && password !== confirmPassword) {
      Alert.alert('Mots de passe différents', 'Les mots de passe ne correspondent pas');
      return false;
    }

    return true;
  };

  const handleGoogleSignIn = async (accessToken: string | undefined) => {
    if (!accessToken) return;
    try {
      const credential = GoogleAuthProvider.credential(accessToken);
      const userCredential = await signInWithCredential(auth, credential);
      handleAuthSuccess(userCredential, 'Google');
    } catch (error: any) {
      console.error('⚠️ Erreur Google Sign-In:', error);
      Alert.alert('Erreur', 'Échec de la connexion avec Google');
      setSocialLoading(null);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const { identityToken } = appleCredential;
      
      if (identityToken) {
        const appleProvider = new OAuthProvider('apple.com');
        const credential = appleProvider.credential({
          idToken: identityToken,
        });

        const userCredential = await signInWithCredential(auth, credential);
        handleAuthSuccess(userCredential, 'Apple');
      }
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED' || error.code === 'ERR_CANCELED') {
        console.log('Connexion Apple annulée');
      } else {
        console.error('⚠️ Erreur Apple Sign-In:', error);
        Alert.alert('Erreur Apple', error.message || 'Échec de la connexion avec Apple');
      }
    } finally {
      setSocialLoading(null);
    }
  };

  const handleAuthSuccess = (userCredential: UserCredential, provider: string) => {
    const welcome = getUserDisplayLabel({
      displayName: userCredential.user.displayName,
      email: userCredential.user.email,
      phoneNumber: userCredential.user.phoneNumber,
    });
    console.log(`ℹ️ Connexion réussie avec ${provider}:`, welcome);
    Alert.alert('Connexion réussie', `Bienvenue ${welcome} !`);
    resetForm();
    onClose();
    onLoginSuccess?.();
  };

  const handleLogin = async (): Promise<void> => {
    console.log('🔄 Tentative de connexion:', email);
    try {
      await login(email, password);
      Alert.alert(
        'Connexion réussie',
        `Bienvenue ${getUserDisplayLabel({ email, displayName: null, phoneNumber: null })} !`,
      );
      resetForm();
      onClose();
      onLoginSuccess?.();
    } catch (error: any) {
      console.error('⚠️ Erreur de connexion:', error);
      const { title, message } = getFirebaseErrorMessage(error);
      Alert.alert(title, error?.message || message);
    }
  };

  const handleRegister = async (): Promise<void> => {
    console.log('🔄 Tentative d\'inscription:', email);
    try {
      const displayName = getUserDisplayLabel({ email, displayName: null, phoneNumber: null });
      await register(email, password, displayName, 'customer');
      Alert.alert('Inscription réussie', `Bienvenue ${displayName} !`);
      resetForm();
      onClose();
      onLoginSuccess?.();
    } catch (error: any) {
      console.error('⚠️ Erreur d\'inscription:', error);
      const { title, message } = getFirebaseErrorMessage(error);
      Alert.alert(title, error?.message || message);
    }
  };

  const handleAuth = async (): Promise<void> => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      if (isLogin) {
        await handleLogin();
      } else {
        await handleRegister();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (): void => {
    resetForm();
    onClose();
  };

  const switchMode = (): void => {
    setIsLogin(!isLogin);
    setPassword('');
    setConfirmPassword('');
    setForgotPasswordMode(false);
  };

  const handleSendPasswordReset = async (): Promise<void> => {
    if (!validateEmail(email)) {
      Alert.alert(
        'Email invalide',
        'Indiquez l’adresse e-mail de votre compte pour recevoir le lien de réinitialisation.'
      );
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert(
        'E-mail envoyé',
        'Si un compte existe avec cette adresse, vous recevrez un lien pour choisir un nouveau mot de passe. Vérifiez aussi vos courriers indésirables.',
        [{ text: 'OK', onPress: () => setForgotPasswordMode(false) }]
      );
      setPassword('');
    } catch (error: any) {
      const { title, message } = getFirebaseErrorMessage(error);
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  const finishPhoneAuth = (e164: string, displayName?: string) => {
    const welcome = displayName?.trim() || formatE164ForDisplay(e164);
    Alert.alert('Connexion réussie', `Bienvenue ${welcome} !`);
    resetForm();
    onClose();
    onLoginSuccess?.();
  };

  const handleSendPhoneCode = async (isResend = false): Promise<void> => {
    const e164 = isResend ? phoneE164 : toE164(phoneCountry.dial, phoneLocal);
    if (!isValidE164(e164, isResend ? undefined : phoneCountry)) {
      Alert.alert(
        ERROR_MESSAGES.INVALID_PHONE.title,
        `Saisissez un numéro ${phoneCountry.name} valide (${phoneCountry.minLocal} chiffres).`,
      );
      return;
    }
    const verifier = recaptchaRef.current;
    if (!verifier) {
      Alert.alert('Erreur', 'Vérification de sécurité indisponible. Réessayez.');
      return;
    }

    setLoading(true);
    try {
      await sendPhoneCode(e164, verifier);
      setPhoneE164(e164);
      setPhoneStep('otp');
      setOtpCode('');
      setOtpCooldown(OTP_COOLDOWN_SECONDS);
    } catch (error: unknown) {
      if (isRecaptchaCancelled(error)) {
        return;
      }
      const firebaseError = error as FirebaseError;
      const { title, message } = getFirebaseErrorMessage(firebaseError);
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPhoneCode = async (): Promise<void> => {
    const code = otpCode.replace(/\D/g, '');
    if (code.length !== 6) {
      Alert.alert('Code incomplet', 'Saisissez le code SMS à 6 chiffres.');
      return;
    }
    setLoading(true);
    try {
      const { needsProfileName } = await confirmPhoneCode(code);
      if (needsProfileName) {
        setPhoneStep('profile');
        return;
      }
      finishPhoneAuth(phoneE164);
    } catch (error: any) {
      const { title, message } = getFirebaseErrorMessage(error);
      Alert.alert(title, error?.message || message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompletePhoneProfile = async (): Promise<void> => {
    const trimmed = phoneFullName.trim().replace(/\s+/g, ' ');
    if (trimmed.length < 2) {
      Alert.alert('Nom requis', 'Saisissez votre nom et prénom.');
      return;
    }
    setLoading(true);
    try {
      await completePhoneProfile(trimmed);
      finishPhoneAuth(phoneE164, trimmed);
    } catch (error: any) {
      const { title, message } = getFirebaseErrorMessage(error);
      Alert.alert(title, error?.message || message);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    setSocialLoading(provider);
    try {
      if (provider === 'google') {
        await googlePromptAsync();
      } else if (provider === 'apple') {
        await handleAppleSignIn();
      }
    } catch (error) {
      console.error(`⚠️ Erreur ${provider} login:`, error);
      setSocialLoading(null);
    }
  };

  return (
    <>
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* EN-TÊTE */}
          <View style={styles.header}>
            <View style={styles.headerBackground} />
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            
            <Animated.View style={[styles.headerContent, slideUp]}>
              <View style={styles.logoContainer}>
                <View style={styles.logo}>
                  <Text style={styles.logoText}>AE</Text>
                </View>
              </View>
              
              <Text style={styles.title}>
                {forgotPasswordMode
                  ? 'Mot de passe oublié'
                  : authMethod === 'phone'
                    ? phoneStep === 'otp'
                      ? 'Code SMS'
                      : phoneStep === 'profile'
                        ? 'Compléter votre profil'
                        : 'Connexion par téléphone'
                    : isLogin
                      ? 'Content de vous revoir ! 👋'
                      : 'Rejoignez A2Express 🚀'}
              </Text>
              <Text style={styles.subtitle}>
                {forgotPasswordMode
                  ? 'Saisissez votre e-mail : nous vous enverrons un lien pour réinitialiser votre mot de passe.'
                  : infoMessage && phoneStep !== 'profile'
                    ? infoMessage
                    : authMethod === 'phone'
                      ? phoneStep === 'otp'
                        ? `Code envoyé au ${formatE164ForDisplay(phoneE164)}`
                        : phoneStep === 'profile'
                          ? 'Indiquez votre nom et prénom pour vos commandes'
                          : 'Recevez un code à 6 chiffres par SMS'
                      : isLogin
                        ? 'Connectez-vous pour accéder à votre compte'
                        : 'Créez votre compte en quelques secondes'}
              </Text>
            </Animated.View>
          </View>

          {/* FORMULAIRE */}
          <Animated.View style={[styles.form, slideUp]}>
            {!forgotPasswordMode && phoneStep !== 'otp' && phoneStep !== 'profile' && (
              <>
                <View style={styles.socialButtonsContainer}>
                  <TouchableOpacity 
                    style={[styles.socialButton, styles.googleButton]}
                    onPress={() => handleSocialLogin('google')}
                    disabled={socialLoading !== null}
                  >
                    {socialLoading === 'google' ? (
                      <ActivityIndicator size="small" color="#DB4437" />
                    ) : (
                      <>
                        <Ionicons name="logo-google" size={24} color="#DB4437" />
                        <Text style={styles.socialButtonText}>Google</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {Platform.OS === 'ios' && (
                    <AppleAuthentication.AppleAuthenticationButton
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                      cornerRadius={8}
                      style={{ flex: 1, height: 48 }}
                      onPress={async () => {
                        await handleSocialLogin('apple');
                      }}
                    />
                  )}
                </View>

                <View style={styles.separator}>
                  <View style={styles.separatorLine} />
                  <Text style={styles.separatorText}>ou continuez avec</Text>
                  <View style={styles.separatorLine} />
                </View>
              </>
            )}

            {!forgotPasswordMode && phoneStep !== 'profile' && (
              <View style={styles.methodTabs}>
                <TouchableOpacity
                  style={[styles.methodTab, authMethod === 'email' && styles.methodTabActive]}
                  onPress={() => {
                    setAuthMethod('email');
                    setPhoneStep('number');
                    setOtpCode('');
                    clearPhoneChallenge();
                  }}
                  disabled={loading}
                >
                  <Ionicons
                    name="mail-outline"
                    size={16}
                    color={authMethod === 'email' ? '#FF6B00' : '#666'}
                  />
                  <Text style={[styles.methodTabText, authMethod === 'email' && styles.methodTabTextActive]}>
                    E-mail
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.methodTab, authMethod === 'phone' && styles.methodTabActive]}
                  onPress={() => {
                    setAuthMethod('phone');
                    setForgotPasswordMode(false);
                  }}
                  disabled={loading}
                >
                  <Ionicons
                    name="call-outline"
                    size={16}
                    color={authMethod === 'phone' ? '#FF6B00' : '#666'}
                  />
                  <Text style={[styles.methodTabText, authMethod === 'phone' && styles.methodTabTextActive]}>
                    Numéro
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {authMethod === 'email' && (
            <>
            {/* EMAIL */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>
                <Ionicons name="mail-outline" size={16} color="#666" /> Email
              </Text>
              <TextInput
                style={styles.input}
                placeholder="votre@email.com"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                editable={!loading && !socialLoading}
              />
            </View>

            {forgotPasswordMode ? (
              <>
                <TouchableOpacity 
                  style={[styles.authButton, loading && styles.authButtonDisabled]}
                  onPress={handleSendPasswordReset}
                  disabled={loading || socialLoading !== null}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <View style={styles.buttonContent}>
                      <Ionicons name="mail-outline" size={20} color="#FFF" />
                      <Text style={styles.authButtonText}>Envoyer le lien par e-mail</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.switchContainer}
                  onPress={() => setForgotPasswordMode(false)}
                  disabled={loading}
                >
                  <Text style={styles.switchText}>
                    <Text style={styles.switchLink}>Retour à la connexion</Text>
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>
                    <Ionicons name="lock-closed-outline" size={16} color="#666" /> Mot de passe
                  </Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={[styles.input, styles.passwordInput]}
                      placeholder="Votre mot de passe"
                      placeholderTextColor="#999"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoComplete="password"
                      editable={!loading && !socialLoading}
                    />
                    <TouchableOpacity 
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeButton}
                      disabled={loading || socialLoading !== null}
                    >
                      <Ionicons 
                        name={showPassword ? "eye-off" : "eye"} 
                        size={20} 
                        color="#666" 
                      />
                    </TouchableOpacity>
                  </View>
                  {!isLogin && (
                    <Text style={styles.passwordHint}>
                      💡 Minimum 6 caractères
                    </Text>
                  )}
                  {isLogin && (
                    <TouchableOpacity
                      style={styles.forgotPasswordLink}
                      onPress={() => setForgotPasswordMode(true)}
                      disabled={loading || socialLoading !== null}
                    >
                      <Text style={styles.forgotPasswordLinkText}>Mot de passe oublié ?</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {!isLogin && (
                  <Animated.View style={[styles.inputContainer, slideUp]}>
                    <Text style={styles.label}>
                      <Ionicons name="lock-closed-outline" size={16} color="#666" /> Confirmer le mot de passe
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Confirmer votre mot de passe"
                      placeholderTextColor="#999"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showPassword}
                      autoComplete="password"
                      editable={!loading && !socialLoading}
                    />
                  </Animated.View>
                )}

                <TouchableOpacity 
                  style={[
                    styles.authButton,
                    (loading || socialLoading) && styles.authButtonDisabled,
                    !isLogin && styles.registerButton
                  ]}
                  onPress={handleAuth}
                  disabled={loading || socialLoading !== null}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <View style={styles.buttonContent}>
                      <Ionicons 
                        name={isLogin ? "log-in-outline" : "person-add-outline"} 
                        size={20} 
                        color="#FFF" 
                      />
                      <Text style={styles.authButtonText}>
                        {isLogin ? 'Se connecter' : 'Créer mon compte'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.switchContainer}
                  onPress={switchMode}
                  disabled={loading || socialLoading !== null}
                >
                  <Text style={styles.switchText}>
                    {isLogin 
                      ? "👉 Pas de compte ? " 
                      : "👈 Déjà un compte ? "
                    }
                    <Text style={styles.switchLink}>
                      {isLogin ? "S'inscrire" : "Se connecter"}
                    </Text>
                  </Text>
                </TouchableOpacity>

                <View style={styles.securityInfo}>
                  <Ionicons name="shield-checkmark-outline" size={16} color="#4CAF50" />
                  <Text style={styles.securityText}>
                    Vos informations sont sécurisées et confidentielles
                  </Text>
                </View>
              </>
            )}
            </>
            )}

            {authMethod === 'phone' && !forgotPasswordMode && phoneStep === 'number' && (
              <>
                <Text style={styles.label}>
                  <Ionicons name="call-outline" size={16} color="#666" /> Numéro de téléphone
                </Text>
                <View style={styles.phoneRow}>
                  <TouchableOpacity
                    style={styles.dialButton}
                    onPress={() => setCountryPickerVisible(true)}
                    disabled={loading}
                  >
                    <Text style={styles.dialCode}>+{phoneCountry.dial}</Text>
                    <Ionicons name="chevron-down" size={16} color="#666" />
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.input, styles.phoneInput]}
                    placeholder={phoneCountry.iso === 'ML' ? '70 12 34 56' : 'Numéro'}
                    placeholderTextColor="#999"
                    value={phoneLocal}
                    onChangeText={setPhoneLocal}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                    editable={!loading}
                  />
                </View>
                <Text style={styles.phoneHint}>
                  Indicatif {phoneCountry.name} (+{phoneCountry.dial}) — format international
                </Text>
                <TouchableOpacity
                  style={[styles.authButton, loading && styles.authButtonDisabled]}
                  onPress={() => handleSendPhoneCode(false)}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <View style={styles.buttonContent}>
                      <Ionicons name="chatbubble-ellipses-outline" size={20} color="#FFF" />
                      <Text style={styles.authButtonText}>Envoyer le code</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </>
            )}

            {authMethod === 'phone' && !forgotPasswordMode && phoneStep === 'otp' && (
              <>
                <Text style={styles.label}>Code à 6 chiffres</Text>
                <View style={styles.otpWrap}>
                  <View style={styles.otpRow} pointerEvents="none">
                    {Array.from({ length: 6 }, (_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.otpBox,
                          otpCode.length === i && styles.otpBoxActive,
                          otpCode[i] ? styles.otpBoxFilled : null,
                        ]}
                      >
                        <Text style={styles.otpDigit}>{otpCode[i] || ''}</Text>
                      </View>
                    ))}
                  </View>
                  <TextInput
                    style={styles.otpHiddenInput}
                    value={otpCode}
                    onChangeText={(text) => setOtpCode(text.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                    textContentType="oneTimeCode"
                    autoComplete="sms-otp"
                    caretHidden
                    editable={!loading}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.authButton, loading && styles.authButtonDisabled]}
                  onPress={handleConfirmPhoneCode}
                  disabled={loading || otpCode.length !== 6}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <View style={styles.buttonContent}>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" />
                      <Text style={styles.authButtonText}>Valider le code</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {otpCooldown > 0 ? (
                  <Text style={styles.cooldownText}>
                    Renvoyer le SMS dans {otpCooldown} s
                  </Text>
                ) : (
                  <TouchableOpacity
                    style={styles.switchContainer}
                    onPress={() => handleSendPhoneCode(true)}
                    disabled={loading}
                  >
                    <Text style={styles.switchLink}>Renvoyer le code</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.switchContainer}
                  onPress={() => {
                    setPhoneStep('number');
                    setOtpCode('');
                    clearPhoneChallenge();
                  }}
                  disabled={loading}
                >
                  <Text style={styles.switchText}>
                    <Text style={styles.switchLink}>Changer de numéro</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {authMethod === 'phone' && !forgotPasswordMode && phoneStep === 'profile' && (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>
                    <Ionicons name="person-outline" size={16} color="#666" /> Saisissez votre Nom et Prénom
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Prénom Nom"
                    placeholderTextColor="#999"
                    value={phoneFullName}
                    onChangeText={setPhoneFullName}
                    autoCapitalize="words"
                    autoComplete="name"
                    textContentType="name"
                    autoFocus
                    editable={!loading}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.authButton, loading && styles.authButtonDisabled]}
                  onPress={handleCompletePhoneProfile}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <View style={styles.buttonContent}>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" />
                      <Text style={styles.authButtonText}>Terminer</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
    <FirebaseRecaptchaVerifierModal ref={recaptchaRef} attemptInvisibleVerification />
    <Modal
      visible={countryPickerVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setCountryPickerVisible(false)}
    >
      <TouchableOpacity
        style={styles.pickerOverlay}
        activeOpacity={1}
        onPress={() => setCountryPickerVisible(false)}
      >
        <View style={styles.pickerCard}>
          <Text style={styles.pickerTitle}>Indicatif pays</Text>
          <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled">
            {PHONE_COUNTRIES.map((country) => (
              <TouchableOpacity
                key={country.iso}
                style={[
                  styles.pickerRow,
                  country.iso === phoneCountry.iso && styles.pickerRowActive,
                ]}
                onPress={() => {
                  setPhoneCountry(country);
                  setCountryPickerVisible(false);
                }}
              >
                <Text style={styles.pickerIso}>{country.iso}</Text>
                <Text style={styles.pickerName}>{country.name}</Text>
                <Text style={styles.pickerDial}>+{country.dial}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    position: 'relative',
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FF6B00',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 25,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 20,
  },
  logo: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  form: {
    flex: 1,
    padding: 25,
    paddingTop: 30,
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  googleButton: {
    backgroundColor: '#FFF',
    borderColor: '#E0E0E0',
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  separatorText: {
    paddingHorizontal: 15,
    fontSize: 14,
    color: '#666',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  input: {
    borderWidth: 2,
    borderColor: '#F0F0F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
    color: '#333',
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 14,
    padding: 4,
  },
  passwordHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    fontStyle: 'italic',
  },
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginTop: 10,
    paddingVertical: 4,
  },
  forgotPasswordLinkText: {
    fontSize: 14,
    color: '#FF6B00',
    fontWeight: '600',
  },
  authButton: {
    backgroundColor: '#FF6B00',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  registerButton: {
    backgroundColor: '#4CAF50',
    shadowColor: '#4CAF50',
  },
  authButtonDisabled: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  switchText: {
    color: '#666',
    fontSize: 14,
  },
  switchLink: {
    color: '#FF6B00',
    fontWeight: 'bold',
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    padding: 12,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E1F5FE',
  },
  securityText: {
    fontSize: 12,
    color: '#0277BD',
    fontWeight: '500',
  },
  methodTabs: {
    flexDirection: 'row',
    backgroundColor: '#F4F4F5',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  methodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  methodTabActive: {
    backgroundColor: '#FFF',
  },
  methodTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  methodTabTextActive: {
    color: '#FF6B00',
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  dialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: '#F0F0F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FAFAFA',
  },
  dialCode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  phoneInput: {
    flex: 1,
    marginBottom: 0,
  },
  phoneHint: {
    marginTop: 8,
    marginBottom: 16,
    fontSize: 12,
    color: '#888',
  },
  otpWrap: {
    position: 'relative',
    marginBottom: 20,
    marginTop: 8,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  otpBox: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  otpBoxActive: {
    borderColor: '#FF6B00',
  },
  otpBoxFilled: {
    backgroundColor: '#FFF',
  },
  otpDigit: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  otpHiddenInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.02,
    color: 'transparent',
    fontSize: 22,
  },
  cooldownText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    paddingVertical: 16,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  pickerCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingVertical: 12,
    maxHeight: 420,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    color: '#1A1A1A',
  },
  pickerList: {
    paddingHorizontal: 8,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 10,
  },
  pickerRowActive: {
    backgroundColor: '#FFF0E6',
  },
  pickerIso: {
    width: 32,
    fontWeight: '700',
    color: '#FF6B00',
  },
  pickerName: {
    flex: 1,
    color: '#333',
    fontSize: 15,
  },
  pickerDial: {
    color: '#666',
    fontWeight: '600',
  },
});