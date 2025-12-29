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
  UserCredential
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

const { width: screenWidth } = Dimensions.get('window');

interface LoginModalProps {
  visible: boolean;
  onClose: () => void;
  onLoginSuccess?: () => void;
}

interface TestAccount {
  email: string;
  password: string;
  role: string;
  color: string;
  icon: string;
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
  CLIENT: 'client',      // ✅ CORRECTION : "client" pour correspondre à Firestore
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

// Fonctions utilitaires séparées pour une meilleure modularité
const createUserProfile = async (userCredential: UserCredential): Promise<void> => {
  const { user } = userCredential;
  const userDocRef = doc(db, 'users', user.uid);
  
  const userData: UserData = {
    uid: user.uid,
    email: user.email,
    displayName: user.email?.split('@')[0] || 'Utilisateur',
    role: USER_ROLES.CLIENT, // ✅ CORRECTION : Utilise "client"
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
  console.log('✅ Nouveau profil créé avec rôle: client');
};

// 🔥 CORRECTION ULTIME : Ne RIEN faire si le document existe
// 🔥 CORRECTION ULTIME : Ne RIEN faire si le document existe
const ensureUserProfile = async (userId: string): Promise<void> => {
  console.log(`🔍 ensureUserProfile pour: ${userId}`);
  
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef); // ✅ CORRECTION : userDocRef

    if (userDoc.exists()) {
      // 🔥 DOCUMENT EXISTANT : NE RIEN FAIRE DU TOUT
      const data = userDoc.data();
      const currentRole = data.role || 'non défini';
      
      console.log(`📋 DOCUMENT EXISTANT DÉTECTÉ`);
      console.log(`🎭 Rôle Firestore: "${currentRole}"`);
      console.log(`📧 Email: ${data.email}`);
      console.log(`👤 DisplayName: ${data.displayName}`);
      
      // 🔥 CRITIQUE : AUCUNE ÉCRITURE, AUCUNE MODIFICATION
      // 🔥 JUSTE LOGGER ET SORTIR
      return;
      
    } else {
      // CAS 2: NOUVEAU UTILISATEUR seulement
      console.log(`🆕 NOUVEAU UTILISATEUR - création profil`);
      
      const currentUser = auth.currentUser;
      const userData = {
        uid: userId,
        email: currentUser?.email || '',
        displayName: currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Utilisateur',
        role: 'client', // 🔥 Uniquement pour les NOUVEAUX
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        lastLogin: new Date(),
        profileCompleted: false,
        phoneNumber: currentUser?.phoneNumber || null,
        photoURL: currentUser?.photoURL || null,
        emailVerified: currentUser?.emailVerified || false
      };
      
      // 🔥 NETTOYER les undefined avant écriture
      const cleanData: Record<string, any> = {};
      for (const [key, value] of Object.entries(userData)) {
        if (value !== undefined && value !== null) {
          cleanData[key] = value;
        }
      }
      
      await setDoc(userDocRef, cleanData);
      console.log(`✅ Nouveau profil créé avec rôle: "client"`);
    }
    
  } catch (error) {
    console.error(`❌ Erreur ensureUserProfile:`, error);
    // 🔥 NE PAS PROPAGER L'ERREUR
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
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [slideAnim] = useState<Animated.Value>(new Animated.Value(0));

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

  const handleLogin = async (): Promise<void> => {
    console.log('🔍 Tentative de connexion:', email);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ Connexion réussie:', userCredential.user.email);

      // 🔥 CORRECTION : ensureUserProfile ne fait RIEN si document existe
      await ensureUserProfile(userCredential.user.uid);

      Alert.alert('🎉 Connexion réussie', `Bienvenue ${userCredential.user.email} !`);
      resetForm();
      onClose();
      onLoginSuccess?.();
    } catch (error: any) {
      console.error('❌ Erreur de connexion:', error);
      const { title, message } = getFirebaseErrorMessage(error);
      Alert.alert(title, message);
    }
  };

  const handleRegister = async (): Promise<void> => {
    console.log('📝 Tentative d\'inscription:', email);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('✅ Inscription réussie:', userCredential.user.email);

      await createUserProfile(userCredential);

      Alert.alert('🎉 Compte créé !', `Bienvenue ${userCredential.user.email} !`);
      resetForm();
      onClose();
      onLoginSuccess?.();
    } catch (error: any) {
      console.error('❌ Erreur d\'inscription:', error);
      const { title, message } = getFirebaseErrorMessage(error);
      Alert.alert(title, message);
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

  const quickLogin = (testEmail: string, testPassword: string = 'password123'): void => {
    setEmail(testEmail);
    setPassword(testPassword);
    
    setTimeout(() => {
      handleAuth();
    }, 500);
  };

  const testAccounts: TestAccount[] = [
    { 
      email: 'superadmin@asmaexpress.com', 
      password: 'password123', 
      role: 'Super Admin', 
      color: '#FF4444',
      icon: 'admin-panel-settings'
    },
    { 
      email: 'admin@asmaexpress.com', 
      password: 'password123', 
      role: 'Admin', 
      color: '#2196F3',
      icon: 'security'
    },
    { 
      email: 'vendeur@asmaexpress.com', 
      password: 'password123', 
      role: 'Vendeur', 
      color: '#4CAF50',
      icon: 'store'
    },
    { 
      email: 'client@asmaexpress.com', 
      password: 'password123', 
      role: 'Client', 
      color: '#FF9800',
      icon: 'person'
    }
  ];

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
                {isLogin ? 'Content de vous revoir ! 👋' : 'Rejoignez ASMA Express 🚀'}
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
                editable={!loading}
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
                  editable={!loading}
                />
                <TouchableOpacity 
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  disabled={loading}
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
                  🔒 Minimum 6 caractères
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
                  editable={!loading}
                />
              </Animated.View>
            )}

            {/* BOUTON PRINCIPAL */}
            <TouchableOpacity 
              style={[
                styles.authButton,
                loading && styles.authButtonDisabled,
                !isLogin && styles.registerButton
              ]}
              onPress={handleAuth}
              disabled={loading}
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
              disabled={loading}
            >
              <Text style={styles.switchText}>
                {isLogin 
                  ? "🎯 Pas de compte ? " 
                  : "✅ Déjà un compte ? "
                }
                <Text style={styles.switchLink}>
                  {isLogin ? "S'inscrire" : "Se connecter"}
                </Text>
              </Text>
            </TouchableOpacity>

            {/* COMPTES DE TEST RAPIDES */}
            {isLogin && (
              <View style={styles.testSection}>
                <Text style={styles.testTitle}>🚀 Connexion rapide (Comptes de test)</Text>
                <Text style={styles.testSubtitle}>Mot de passe pour tous : <Text style={styles.testPassword}>password123</Text></Text>
                
                <View style={styles.testButtons}>
                  {testAccounts.map((account) => (
                    <TouchableOpacity 
                      key={account.email}
                      style={[styles.testButton, { backgroundColor: account.color }]}
                      onPress={() => quickLogin(account.email, account.password)}
                      disabled={loading}
                    >
                      <MaterialIcons name={account.icon as any} size={16} color="#FFF" />
                      <Text style={styles.testButtonText}>{account.role}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

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
  testSection: {
    marginTop: 25,
    padding: 20,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B00',
  },
  testTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  testSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 16,
  },
  testButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  testButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  testButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  testPassword: {
    fontWeight: 'bold',
    color: '#FF6B00',
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