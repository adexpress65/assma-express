// apps/mobile/src/components/account/LoginModal.tsx
import React, { useState } from 'react';
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
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  UserCredential,
  GoogleAuthProvider,
  signInWithCredential,
  FacebookAuthProvider,
  OAuthProvider
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as AppleAuthentication from 'expo-apple-authentication';

WebBrowser.maybeCompleteAuthSession();

const { width: screenWidth } = Dimensions.get('window');

interface LoginModalProps {
  visible: boolean;
  onClose: () => void;
  onLoginSuccess?: () => void;
}

interface UserData {
  uid: string;
  email: string | null;
  displayName: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  lastLogin: Date;
  profileCompleted: boolean;
  preferences?: {
    notifications: boolean;
    newsletter: boolean;
  };
}

// Types d'erreur Firebase
type FirebaseError = {
  code: string;
  message: string;
};

// Constantes pour éviter les magic strings
const USER_ROLES = {
  CLIENT: 'client',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
  SELLER: 'seller'
} as const;

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
  DEFAULT: {
    title: 'Erreur',
    message: 'Une erreur est survenue. Veuillez réessayer.'
  }
} as const;

// Fonctions utilitaires
const createUserProfile = async (userCredential: UserCredential): Promise<void> => {
  const { user } = userCredential;
  const userDocRef = doc(db, 'users', user.uid);
  
  const userData: UserData = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || user.email?.split('@')[0] || 'Utilisateur',
    role: USER_ROLES.CLIENT,
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    lastLogin: new Date(),
    profileCompleted: false,
    preferences: {
      notifications: true,
      newsletter: false
    }
  };

  await setDoc(userDocRef, userData);
  console.log('? Nouveau profil créé avec rôle: client');
};

const ensureUserProfile = async (userId: string): Promise<void> => {
  console.log(`?? ensureUserProfile pour: ${userId}`);
  
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const data = userDoc.data();
      console.log(`?? DOCUMENT EXISTANT DÉTECTÉ`);
      console.log(`?? Rôle Firestore: "${data.role || 'non défini'}"`);
      return;
    } else {
      console.log(`?? NOUVEAU UTILISATEUR - création profil`);
      
      const currentUser = auth.currentUser;
      const userData = {
        uid: userId,
        email: currentUser?.email || '',
        displayName: currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Utilisateur',
        role: 'client',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        lastLogin: new Date(),
        profileCompleted: false,
        phoneNumber: currentUser?.phoneNumber || null,
        photoURL: currentUser?.photoURL || null,
        emailVerified: currentUser?.emailVerified || false
      };
      
      const cleanData: Record<string, any> = {};
      for (const [key, value] of Object.entries(userData)) {
        if (value !== undefined && value !== null) {
          cleanData[key] = value;
        }
      }
      
      await setDoc(userDocRef, cleanData);
      console.log(`? Nouveau profil créé avec rôle: "client"`);
    }
    
  } catch (error) {
    console.error(`? Erreur ensureUserProfile:`, error);
  }
};

const getFirebaseErrorMessage = (error: FirebaseError): { title: string; message: string } => {
  const { code, message } = error;

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
    default:
      console.warn('Code d\'erreur Firebase non géré:', code, message);
      return { title: ERROR_MESSAGES.DEFAULT.title, message: message || ERROR_MESSAGES.DEFAULT.message };
  }
};

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export default function LoginModal({ visible, onClose, onLoginSuccess }: LoginModalProps) {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'facebook' | 'apple' | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [slideAnim] = useState<Animated.Value>(new Animated.Value(0));

  // Configuration des providers d'authentification sociale
  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    expoClientId: 'VOTRE_CLIENT_ID_EXPO_GOOGLE',
    iosClientId: 'VOTRE_CLIENT_ID_IOS_GOOGLE',
    androidClientId: 'VOTRE_CLIENT_ID_ANDROID_GOOGLE',
    webClientId: 'VOTRE_CLIENT_ID_WEB_GOOGLE',
  });

  const [facebookRequest, facebookResponse, facebookPromptAsync] = Facebook.useAuthRequest({
    clientId: 'VOTRE_CLIENT_ID_FACEBOOK',
  });

  React.useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible, slideAnim]);

  // Gestion de la réponse Google
  React.useEffect(() => {
    if (googleResponse?.type === 'success') {
      handleGoogleSignIn(googleResponse.authentication?.accessToken);
    }
  }, [googleResponse]);

  // Gestion de la réponse Facebook
  React.useEffect(() => {
    if (facebookResponse?.type === 'success') {
      handleFacebookSignIn(facebookResponse.authentication?.accessToken);
    }
  }, [facebookResponse]);

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
      
      await ensureUserProfile(userCredential.user.uid);
      handleAuthSuccess(userCredential, 'Google');
    } catch (error: any) {
      console.error('? Erreur Google Sign-In:', error);
      Alert.alert('Erreur', 'Échec de la connexion avec Google');
      setSocialLoading(null);
    }
  };

  const handleFacebookSignIn = async (accessToken: string | undefined) => {
    if (!accessToken) return;
    
    try {
      const credential = FacebookAuthProvider.credential(accessToken);
      const userCredential = await signInWithCredential(auth, credential);
      
      await ensureUserProfile(userCredential.user.uid);
      handleAuthSuccess(userCredential, 'Facebook');
    } catch (error: any) {
      console.error('? Erreur Facebook Sign-In:', error);
      Alert.alert('Erreur', 'Échec de la connexion avec Facebook');
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
        const provider = new OAuthProvider('apple.com');
        const credential = provider.credential({
          idToken: identityToken,
        });

        const userCredential = await signInWithCredential(auth, credential);
        
        await ensureUserProfile(userCredential.user.uid);
        handleAuthSuccess(userCredential, 'Apple');
      }
    } catch (error: any) {
      if (error.code === 'ERR_CANCELED') {
        // L'utilisateur a annulé la connexion
        console.log('Connexion Apple annulée');
      } else {
        console.error('? Erreur Apple Sign-In:', error);
        Alert.alert('Erreur', 'Échec de la connexion avec Apple');
      }
      setSocialLoading(null);
    }
  };

  const handleAuthSuccess = (userCredential: UserCredential, provider: string) => {
    console.log(`? Connexion réussie avec ${provider}:`, userCredential.user.email);
    Alert.alert('?? Connexion réussie', `Bienvenue ${userCredential.user.email || 'Utilisateur'} !`);
    resetForm();
    onClose();
    onLoginSuccess?.();
  };

  const handleLogin = async (): Promise<void> => {
    console.log('?? Tentative de connexion:', email);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await ensureUserProfile(userCredential.user.uid);
      handleAuthSuccess(userCredential, 'Email');
    } catch (error: any) {
      console.error('? Erreur de connexion:', error);
      const { title, message } = getFirebaseErrorMessage(error);
      Alert.alert(title, message);
      setLoading(false);
    }
  };

  const handleRegister = async (): Promise<void> => {
    console.log('?? Tentative d\'inscription:', email);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await createUserProfile(userCredential);
      handleAuthSuccess(userCredential, 'Email');
    } catch (error: any) {
      console.error('? Erreur d\'inscription:', error);
      const { title, message } = getFirebaseErrorMessage(error);
      Alert.alert(title, message);
      setLoading(false);
    }
  };

  const handleAuth = async (): Promise<void> => {
    if (!validateForm()) {
      return;
    }

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
  };

  const handleSocialLogin = async (provider: 'google' | 'facebook' | 'apple') => {
    setSocialLoading(provider);
    
    try {
      if (provider === 'google') {
        await googlePromptAsync();
      } else if (provider === 'facebook') {
        await facebookPromptAsync();
      } else if (provider === 'apple') {
        await handleAppleSignIn();
      }
    } catch (error) {
      console.error(`? Erreur ${provider} login:`, error);
      setSocialLoading(null);
    }
  };

  return (
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
          {/* EN-TÊTE AVEC GRADIENT */}
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
                {isLogin ? 'Content de vous revoir ! ??' : 'Rejoignez A2Express ??'}
              </Text>
              <Text style={styles.subtitle}>
                {isLogin 
                  ? 'Connectez-vous pour accéder à votre compte' 
                  : 'Créez votre compte en quelques secondes'
                }
              </Text>
            </Animated.View>
          </View>

          {/* FORMULAIRE */}
          <Animated.View style={[styles.form, slideUp]}>
            {/* Boutons d'authentification sociale */}
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

              <TouchableOpacity 
                style={[styles.socialButton, styles.facebookButton]}
                onPress={() => handleSocialLogin('facebook')}
                disabled={socialLoading !== null}
              >
                {socialLoading === 'facebook' ? (
                  <ActivityIndicator size="small" color="#4267B2" />
                ) : (
                  <>
                    <Ionicons name="logo-facebook" size={24} color="#4267B2" />
                    <Text style={styles.socialButtonText}>Facebook</Text>
                  </>
                )}
              </TouchableOpacity>

              {Platform.OS === 'ios' && (
                <TouchableOpacity 
                  style={[styles.socialButton, styles.appleButton]}
                  onPress={() => handleSocialLogin('apple')}
                  disabled={socialLoading !== null}
                >
                  {socialLoading === 'apple' ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <>
                      <Ionicons name="logo-apple" size={24} color="#000" />
                      <Text style={styles.socialButtonText}>Apple</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Séparateur */}
            <View style={styles.separator}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>ou continuez avec</Text>
              <View style={styles.separatorLine} />
            </View>

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

            {/* MOT DE PASSE */}
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
                  ?? Minimum 6 caractères
                </Text>
              )}
            </View>

            {/* CONFIRMATION MOT DE PASSE (INSCRIPTION) */}
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

            {/* BOUTON PRINCIPAL */}
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

            {/* SWITCH LOGIN/INSCRIPTION */}
            <TouchableOpacity 
              style={styles.switchContainer}
              onPress={switchMode}
              disabled={loading || socialLoading !== null}
            >
              <Text style={styles.switchText}>
                {isLogin 
                  ? "?? Pas de compte ? " 
                  : "? Déjà un compte ? "
                }
                <Text style={styles.switchLink}>
                  {isLogin ? "S'inscrire" : "Se connecter"}
                </Text>
              </Text>
            </TouchableOpacity>

            {/* INFORMATIONS DE SÉCURITÉ */}
            <View style={styles.securityInfo}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#4CAF50" />
              <Text style={styles.securityText}>
                Vos informations sont sécurisées et confidentielles
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
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
  facebookButton: {
    backgroundColor: '#FFF',
    borderColor: '#E0E0E0',
  },
  appleButton: {
    backgroundColor: '#000',
    borderColor: '#000',
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
});
