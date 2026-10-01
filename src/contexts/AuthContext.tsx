// apps/mobile/src/contexts/AuthContext.tsx - VERSION FINALE CORRIGÉE
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User,
  GoogleAuthProvider,
  signInWithCredential,
  sendEmailVerification,
  AuthError,
  signInWithPhoneNumber,
  type ApplicationVerifier,
  type ConfirmationResult,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, Timestamp, collection, query, where, getDocs, limit, writeBatch } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { setSentryUser } from '@/config/sentry';
import { resolveAuthorizedRole } from '@/utils/resolveAuthRole';
import {
  getUserDisplayLabel,
  isPhoneAuthUser,
  isSocialAuthProvider,
  mapFirebaseAuthProvider,
  profileNeedsDisplayName,
} from '@/utils/userIdentity';
import { isRecaptchaCancelled, recaptchaCancelledError } from '@/components/auth/FirebaseRecaptchaVerifierModal';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { Alert } from 'react-native';

// Initialiser pour Google Auth
WebBrowser.maybeCompleteAuthSession();

// Types des rôles
export type UserRole = 'super-admin' | 'admin' | 'seller' | 'customer' | 'visitor';

interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber: string | null;
  emailVerified: boolean;
  providerData: any[];
}

interface UserProfile {
  uid: string;
  /** Chaîne vide autorisée (compte téléphone sans e-mail). */
  email: string;
  displayName: string;
  name?: string;
  role: UserRole;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isActive: boolean;
  phoneNumber?: string;
  photoURL?: string;
  address?: string;
  providerId?: string;
  socialAccounts?: {
    google?: boolean;
    facebook?: boolean;
    apple?: boolean;
  };
  lastLogin?: Timestamp;
  sellerInfo?: {
    shopName?: string;
    description?: string;
    phone?: string;
    address?: string;
    isVerified?: boolean;
    rating?: number;
    totalSales?: number;
    businessType?: string;
  };
  adminInfo?: {
    permissions?: string[];
    department?: string;
    accessLevel?: number;
  };
  /** ID document Firestore `companies/{companyId}` — lié au vendeur (backfill ou création) */
  companyId?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  userProfile: UserProfile | null;
  userRole: UserRole;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** `true` lorsque aucune session Firebase n'est active (parcours invité). */
  isGuest: boolean;
  authError: string | null;
  
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string, role?: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  /** Envoie le SMS OTP (E.164). Le verifier reCAPTCHA vient de la WebView. */
  sendPhoneCode: (phoneE164: string, appVerifier: ApplicationVerifier) => Promise<void>;
  confirmPhoneCode: (code: string) => Promise<{ needsProfileName: boolean }>;
  completePhoneProfile: (fullName: string) => Promise<void>;
  clearPhoneChallenge: () => void;
  
  clearError: () => void;
  
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isSeller: boolean;
  isCustomer: boolean;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  hasPermission: (permission: string) => boolean;
  
  refreshUserProfile: () => Promise<void>;
  updateEmailVerification: () => Promise<void>;
  /** Compte dont le provider principal est le téléphone (SMS OTP). */
  isPhoneProvider: boolean;
  
  // Debug
  debugLogState: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Configuration Google
const GOOGLE_CONFIG = {
  expoClientId: '251188713496-uqulsfo1ke4bf72gjkh8n5ljhtfr8898.apps.googleusercontent.com',
  iosClientId: '251188713496-uqulsfo1ke4bf72gjkh8n5ljhtfr8898.apps.googleusercontent.com',
  androidClientId: '251188713496-uqulsfo1ke4bf72gjkh8n5ljhtfr8898.apps.googleusercontent.com',
  webClientId: '251188713496-uqulsfo1ke4bf72gjkh8n5ljhtfr8898.apps.googleusercontent.com',
} as const;

// Permissions par rôle
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  'super-admin': ['*'],
  'admin': ['read', 'write', 'manage_users', 'manage_products', 'manage_orders', 'analytics'],
  'seller': ['read', 'write_own_products', 'manage_own_orders', 'manage_shop'],
  'customer': ['read', 'create_order', 'manage_profile', 'view_history'],
  'visitor': ['read_public']
};

// Définir les rôles valides pour la création
const VALID_CREATION_ROLES: UserRole[] = ['customer', 'seller'];

const normalizeStoredRole = (role: unknown): UserRole | null => {
  const raw = String(role ?? '').trim().toLowerCase();
  if (['super-admin', 'super_admin', 'superadmin', 'super admin'].includes(raw)) return 'super-admin';
  if (raw === 'admin') return 'admin';
  if (raw === 'seller') return 'seller';
  if (raw === 'customer' || raw === 'client' || raw === 'user') return 'customer';
  if (raw === 'visitor') return 'visitor';
  return null;
};

const roleForNewProfile = (role: UserRole): UserRole => {
  if (role === 'seller') return 'seller';
  if (role === 'admin' || role === 'super-admin') return role;
  return 'customer';
};

const phoneLookupValues = (phone: string): string[] => {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\D/g, '');
  const values = new Set<string>();
  if (raw) values.add(raw);
  if (digits) {
    values.add(digits);
    values.add(`+${digits}`);
  }
  return [...values];
};

const findUserDocByPhone = async (phone: string, excludeUid: string) => {
  try {
    const snaps = await Promise.all(
      phoneLookupValues(phone).map((value) =>
        getDocs(query(collection(db, 'users'), where('phoneNumber', '==', value), limit(5))),
      ),
    );
    for (const snap of snaps) {
      const match = snap.docs.find((d) => d.id !== excludeUid && d.data()?.mergedIntoUid == null);
      if (match) return match;
    }
    for (const snap of snaps) {
      const match = snap.docs.find((d) => d.id !== excludeUid);
      if (match) return match;
    }
  } catch (error) {
    console.warn('⚠️ Recherche profil par téléphone impossible:', error);
  }
  return null;
};

const reassignOrdersToUid = async (fromUid: string, toUid: string) => {
  try {
    const ordersSnap = await getDocs(
      query(collection(db, 'orders'), where('userId', '==', fromUid), limit(100)),
    );
    if (ordersSnap.empty) return;
    const batch = writeBatch(db);
    ordersSnap.forEach((orderDoc) => {
      batch.update(orderDoc.ref, {
        userId: toUid,
        previousUserId: fromUid,
        updatedAt: Timestamp.now(),
      });
    });
    await batch.commit();
    console.log(`📦 ${ordersSnap.size} commande(s) réassociée(s) vers ${toUid}`);
  } catch (error) {
    console.warn('⚠️ Réassociation des commandes partielle:', error);
  }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<{
    user: AuthUser | null;
    userProfile: UserProfile | null;
    isLoading: boolean;
    error: string | null;
  }>({
    user: null,
    userProfile: null,
    isLoading: true,
    error: null
  });

  const phoneConfirmationRef = useRef<ConfirmationResult | null>(null);

  // Configuration Google Auth
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: GOOGLE_CONFIG.expoClientId,
    iosClientId: GOOGLE_CONFIG.iosClientId,
    androidClientId: GOOGLE_CONFIG.androidClientId,
    webClientId: GOOGLE_CONFIG.webClientId,
    scopes: ['openid', 'profile', 'email'],
  });

  // Dérivé de l'état
  const userRole: UserRole = authState.userProfile
  ? normalizeStoredRole(authState.userProfile.role) || 'visitor'
  : 'visitor';
  const isAuthenticated = !!authState.user;
  const isGuest = !authState.user && !authState.isLoading;
  const isSuperAdmin = userRole === 'super-admin';
  const isAdmin = userRole === 'admin';
  const isSeller = userRole === 'seller';
  const isCustomer = userRole === 'customer';
  const isPhoneProvider = isPhoneAuthUser(authState.user, authState.userProfile);

  useEffect(() => {
    const u = authState.user;
    setSentryUser({
      id: u?.uid ?? null,
      email: u?.email ?? undefined,
      username: u?.displayName ?? undefined,
    });
  }, [authState.user]);

  // Convertir User Firebase en AuthUser
  const firebaseUserToAuthUser = useCallback((firebaseUser: User): AuthUser => ({
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    phoneNumber: firebaseUser.phoneNumber,
    emailVerified: firebaseUser.emailVerified,
    providerData: firebaseUser.providerData
  }), []);

  // Gestion des erreurs
  const handleAuthError = useCallback((error: unknown, defaultMessage: string): string => {
    console.error('Auth Error:', error);
    
    let errorMessage = defaultMessage;
    
    if (error instanceof Error) {
      const authError = error as AuthError;
      
      if (authError.code) {
        switch (authError.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'Cette adresse email est déjà utilisée';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Adresse email invalide';
            break;
          case 'auth/weak-password':
            errorMessage = 'Le mot de passe doit contenir au moins 6 caractères';
            break;
          case 'auth/user-not-found':
            errorMessage = 'Aucun compte trouvé avec cette adresse email';
            break;
          case 'auth/wrong-password':
            errorMessage = 'Mot de passe incorrect';
            break;
          case 'auth/invalid-credential':
          case 'auth/invalid-login-credentials':
            errorMessage = 'Identifiants invalides. Vérifiez email et mot de passe.';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Trop de tentatives. Réessayez plus tard';
            break;
          case 'auth/user-disabled':
            errorMessage = 'Ce compte a été désactivé';
            break;
          case 'auth/account-exists-with-different-credential':
            errorMessage = 'Un compte existe déjà avec cet email';
            break;
          case 'auth/popup-closed-by-user':
            errorMessage = 'Connexion annulée';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Problème de connexion réseau';
            break;
          case 'auth/invalid-phone-number':
          case 'auth/missing-phone-number':
            errorMessage = 'Numéro de téléphone invalide';
            break;
          case 'auth/quota-exceeded':
          case 'auth/error-code:-39':
            errorMessage =
              'Firebase a refusé l’envoi du SMS (quota, anti-abus ou pays non desservi). Réessayez plus tard ou utilisez un numéro de test.';
            break;
          case 'auth/captcha-check-failed':
            errorMessage = 'Échec de la vérification de sécurité. Réessayez';
            break;
          case 'auth/invalid-verification-code':
          case 'auth/invalid-verification-id':
            errorMessage = 'Code SMS incorrect';
            break;
          case 'auth/code-expired':
          case 'auth/session-expired':
            errorMessage = 'Le code a expiré. Renvoyez un nouveau SMS';
            break;
          case 'auth/missing-verification-code':
            errorMessage = 'Saisissez le code à 6 chiffres';
            break;
          default:
            if (/error-code:-39/i.test(authError.code) || /error-code:-39/i.test(authError.message)) {
              errorMessage =
                'Firebase a refusé l’envoi du SMS (quota, anti-abus ou pays non desservi). Réessayez plus tard ou utilisez un numéro de test.';
            } else {
              errorMessage = authError.message || defaultMessage;
            }
        }
      } else {
        errorMessage = error.message || defaultMessage;
      }
    }
    
    setAuthState(prev => ({ ...prev, error: errorMessage }));
    return errorMessage;
  }, []);

  const clearError = useCallback(() => {
    setAuthState(prev => ({ ...prev, error: null }));
  }, []);

  // Nettoyer les données pour Firestore
  const cleanFirestoreData = useCallback((data: Record<string, any>): Record<string, any> => {
    const cleaned: Record<string, any> = {};
    
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (value instanceof Date) {
          cleaned[key] = Timestamp.fromDate(value);
        } else {
          cleaned[key] = value;
        }
      }
    });
    
    return cleaned;
  }, []);

  // Créer un profil utilisateur par défaut
  const createDefaultProfile = useCallback((
    firebaseUser: User,
    role: UserRole = 'customer',
    provider?: string,
    displayNameOverride?: string,
  ): UserProfile => {
    const now = Timestamp.now();
    const storedRole = roleForNewProfile(role);
    const resolvedProvider = mapFirebaseAuthProvider(
      firebaseUser.providerData?.[0]?.providerId,
      provider,
    );
    const email = firebaseUser.email || '';
    const phoneNumber = firebaseUser.phoneNumber || undefined;
    const explicitName = String(displayNameOverride ?? '').trim();
    const authName = String(firebaseUser.displayName || '').trim();
    const displayName = explicitName || authName || (provider === 'phone' ? '' : getUserDisplayLabel({
      displayName: firebaseUser.displayName,
      email,
      phoneNumber,
    }));

    const profile: UserProfile = {
      uid: firebaseUser.uid,
      email,
      displayName,
      role: storedRole,
      createdAt: now,
      updatedAt: now,
      isActive: true,
      lastLogin: now,
    };

    if (phoneNumber) {
      profile.phoneNumber = phoneNumber;
    }
    if (displayName) {
      profile.name = displayName;
    }
    if (firebaseUser.photoURL) {
      profile.photoURL = firebaseUser.photoURL;
    }
    if (resolvedProvider) {
      profile.providerId = resolvedProvider;
      if (isSocialAuthProvider(resolvedProvider)) {
        profile.socialAccounts = { [resolvedProvider]: true };
      }
    }

    if (storedRole === 'seller') {
      profile.sellerInfo = {
        shopName: displayName,
        isVerified: false,
        rating: 0,
        totalSales: 0,
        businessType: 'individual'
      };
    } else if (storedRole === 'admin' || storedRole === 'super-admin') {
      profile.adminInfo = {
        permissions: ROLE_PERMISSIONS[storedRole],
        department: 'Administration',
        accessLevel: storedRole === 'super-admin' ? 100 : 50
      };
    }

    return profile;
  }, []);

// 🔥 VERSION HYBRIDE SÉCURISÉE : SANS FILTRE STRICT ET ADAPTÉE POUR APPLE
const loadUserProfile = useCallback(async (
  firebaseUser: User,
  provider?: string,
  creationRole: UserRole = 'customer',
): Promise<UserProfile> => {
  try {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userRef);
    const resolvedProvider = mapFirebaseAuthProvider(
      firebaseUser.providerData?.[0]?.providerId,
      provider,
    );

    if (userDoc.exists()) {
      const existingData = userDoc.data();
      const authorizedRole = await resolveAuthorizedRole(
        firebaseUser,
        existingData.role,
      );

      const updates: Record<string, any> = {
        lastLogin: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      if (resolvedProvider) {
        updates.providerId = resolvedProvider;
        if (isSocialAuthProvider(resolvedProvider)) {
          updates[`socialAccounts.${resolvedProvider}`] = true;
        }
      }

      const authPhone = firebaseUser.phoneNumber || '';
      if (authPhone && !existingData.phoneNumber) {
        updates.phoneNumber = authPhone;
      }

      const existingName = String(existingData.name || existingData.displayName || '').trim();
      const authName = String(firebaseUser.displayName || '').trim();
      if (!existingName && authName) {
        updates.displayName = authName;
        updates.name = authName;
      }

      await updateDoc(userRef, updates);

      const resolvedName = String(
        updates.displayName || existingData.displayName || existingData.name || firebaseUser.displayName || '',
      ).trim();

      const profile: UserProfile = {
        uid: firebaseUser.uid,
        email: existingData.email || firebaseUser.email || '',
        displayName: resolvedName,
        name: String(updates.name || existingData.name || resolvedName || '').trim() || undefined,
        role: authorizedRole,
        createdAt: existingData.createdAt || Timestamp.now(),
        updatedAt: updates.updatedAt,
        isActive: existingData.isActive !== false,
        lastLogin: updates.lastLogin,
        phoneNumber: existingData.phoneNumber || firebaseUser.phoneNumber || '',
        photoURL: existingData.photoURL || firebaseUser.photoURL || undefined,
        address: existingData.address || '',
        providerId: resolvedProvider || existingData.providerId || '',
        socialAccounts: existingData.socialAccounts || {},
        sellerInfo: existingData.sellerInfo,
        adminInfo: existingData.adminInfo,
        companyId: existingData.companyId,
      };

      if (isSocialAuthProvider(resolvedProvider)) {
        profile.socialAccounts = {
          ...profile.socialAccounts,
          [resolvedProvider]: true,
        };
      }

      console.log(`✅ [Auth] Profil chargé — rôle autorisé : ${profile.role}`);
      return profile;
    }

    const phone = firebaseUser.phoneNumber || '';
    if (phone) {
      const existingByPhone = await findUserDocByPhone(phone, firebaseUser.uid);
      if (existingByPhone) {
        console.log(`🔗 Profil existant trouvé pour ${phone} — uid ${existingByPhone.id}`);
        const existingData = existingByPhone.data();
        const fallbackRole = roleForNewProfile(
          VALID_CREATION_ROLES.includes(creationRole) ? creationRole : 'customer',
        );
        const authorizedRole = await resolveAuthorizedRole(
          firebaseUser,
          existingData.role || fallbackRole,
        );
        const existingName = String(existingData.name || existingData.displayName || '').trim();
        const adopted: UserProfile = {
          ...createDefaultProfile(
            firebaseUser,
            roleForNewProfile(authorizedRole),
            resolvedProvider,
            existingName,
          ),
          email: existingData.email || firebaseUser.email || '',
          displayName: existingName,
          name: existingName || undefined,
          createdAt: existingData.createdAt || Timestamp.now(),
          phoneNumber: phone,
          photoURL: existingData.photoURL || firebaseUser.photoURL || undefined,
          address: existingData.address || '',
          socialAccounts: existingData.socialAccounts || {},
          sellerInfo: existingData.sellerInfo,
          adminInfo: existingData.adminInfo,
          companyId: existingData.companyId,
        };
        if (resolvedProvider && isSocialAuthProvider(resolvedProvider)) {
          adopted.socialAccounts = {
            ...adopted.socialAccounts,
            [resolvedProvider]: true,
          };
        }
        await setDoc(userRef, {
          ...cleanFirestoreData(adopted),
          linkedFromUid: existingByPhone.id,
        });
        try {
          await updateDoc(existingByPhone.ref, {
            mergedIntoUid: firebaseUser.uid,
            isActive: false,
            updatedAt: Timestamp.now(),
          });
        } catch (error) {
          console.warn('⚠️ Ancien profil non marqué comme fusionné:', error);
        }
        await reassignOrdersToUid(existingByPhone.id, firebaseUser.uid);
        console.log(`✅ Profil téléphone lié depuis ${existingByPhone.id}`);
        return adopted;
      }
    }

    console.log(`🆕 Création nouveau profil - UID: ${firebaseUser.uid}`);

    const fallbackRole = roleForNewProfile(
      VALID_CREATION_ROLES.includes(creationRole) ? creationRole : 'customer',
    );
    const authorizedRole = await resolveAuthorizedRole(firebaseUser, fallbackRole);
    const defaultProfile = createDefaultProfile(
      firebaseUser,
      roleForNewProfile(authorizedRole),
      resolvedProvider,
    );

    const cleanProfile = cleanFirestoreData(defaultProfile);
    await setDoc(userRef, cleanProfile);

    console.log(`✅ Nouveau profil créé avec rôle: ${defaultProfile.role}`);
    return defaultProfile;
  } catch (error) {
    console.error('❌ Erreur critique dans loadUserProfile:', error);
    throw error instanceof Error ? error : new Error('Erreur chargement profil utilisateur');
  }
}, [cleanFirestoreData, createDefaultProfile]);

  // 🔥 Fonction de debug pour vérifier l'état
  const debugLogState = useCallback(() => {
    console.log('=== DEBUG AUTH STATE ===');
    console.log('User:', authState.user?.uid);
    console.log('User Profile:', authState.userProfile);
    console.log('Role:', userRole);
    console.log('Is Loading:', authState.isLoading);
    console.log('========================');
  }, [authState, userRole]);

  // Rafraîchir le profil utilisateur
  const refreshUserProfile = useCallback(async (): Promise<void> => {
    if (!authState.user || !auth) {
      console.log('❌ Impossible de rafraîchir: utilisateur non connecté');
      return;
    }
    
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        console.log('🔄 Rafraîchissement du profil...');
        const profile = await loadUserProfile(currentUser);
        setAuthState(prev => ({ 
          ...prev, 
          user: firebaseUserToAuthUser(currentUser),
          userProfile: profile 
        }));
        console.log(`✅ Profil rafraîchi - Rôle: ${profile.role}`);
      }
    } catch (error) {
      console.error('❌ Erreur rafraîchissement:', error);
      handleAuthError(error, 'Erreur de rafraîchissement du profil');
    }
  }, [authState.user, firebaseUserToAuthUser, handleAuthError, loadUserProfile]);

  // Mettre à jour la vérification email
  const updateEmailVerification = useCallback(async (): Promise<void> => {
    if (!auth.currentUser) return;
    if (isPhoneAuthUser(auth.currentUser)) return;

    await auth.currentUser.reload();
    const updatedUser = auth.currentUser;

    const authUser = firebaseUserToAuthUser(updatedUser);
    setAuthState(prev => ({
      ...prev,
      user: authUser
    }));
  }, [firebaseUserToAuthUser]);

  // Inscription
  const register = useCallback(async (
    email: string, 
    password: string, 
    displayName: string, 
    role: UserRole = 'customer'
  ): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Validation du rôle
      if (role === 'super-admin') {
        throw new Error('Le rôle super-admin ne peut pas être attribué lors de l\'inscription');
      }
      
      if (!VALID_CREATION_ROLES.includes(role)) {
        throw new Error(`Rôle invalide pour l'inscription: ${role}`);
      }
      
      // Créer l'utilisateur dans Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Mettre à jour le profil Auth
      if (displayName) {
        await updateProfile(firebaseUser, { displayName });
      }

      if (firebaseUser.email) {
        await sendEmailVerification(firebaseUser);
      }

      const storedRole: UserRole = role === 'seller' ? 'seller' : 'customer';
      const userProfile = await loadUserProfile(firebaseUser, 'password', storedRole);

      const authUser = firebaseUserToAuthUser(firebaseUser);

      setAuthState({
        user: authUser,
        userProfile,
        isLoading: false,
        error: null
      });

      console.log(`✅ Utilisateur créé - Rôle autorisé: ${userProfile.role}`);
      
    } catch (error) {
      const errorMessage = handleAuthError(error, 'Erreur lors de l\'inscription');
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw new Error(errorMessage);
    }
  }, [firebaseUserToAuthUser, handleAuthError, loadUserProfile]);

  // Connexion
  const login = useCallback(async (email: string, password: string): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      const normalizedEmail = email.trim().toLowerCase();
      
      console.log(`🔐 Tentative de connexion: ${normalizedEmail}`);
      const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      const firebaseUser = userCredential.user;

      // Charger le profil
      const profile = await loadUserProfile(firebaseUser);
      const authUser = firebaseUserToAuthUser(firebaseUser);

      setAuthState({
        user: authUser,
        userProfile: profile,
        isLoading: false,
        error: null
      });

      console.log(`✅ Connexion réussie - Rôle: ${profile.role} - Email vérifié: ${firebaseUser.emailVerified}`);

    } catch (error) {
      const errorMessage = handleAuthError(error, 'Erreur lors de la connexion');
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw new Error(errorMessage);
    }
  }, [firebaseUserToAuthUser, handleAuthError, loadUserProfile]);

  // Connexion Google
  const signInWithGoogle = useCallback(async (): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      const result = await promptAsync();
      
      if (result?.type !== 'success') {
        throw new Error('Authentification Google annulée');
      }

      const { id_token } = result.params;
      const credential = GoogleAuthProvider.credential(id_token);
      const userCredential = await signInWithCredential(auth, credential);
      const firebaseUser = userCredential.user;

      const profile = await loadUserProfile(firebaseUser, 'google');
      const authUser = firebaseUserToAuthUser(firebaseUser);

      setAuthState({
        user: authUser,
        userProfile: profile,
        isLoading: false,
        error: null
      });

      console.log(`✅ Connexion Google réussie - Rôle: ${profile.role}`);

    } catch (error) {
      const errorMessage = handleAuthError(error, 'Erreur lors de la connexion Google');
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw new Error(errorMessage);
    }
  }, [firebaseUserToAuthUser, handleAuthError, loadUserProfile, promptAsync]);

  // Connexion Apple
  const signInWithApple = useCallback(async (): Promise<void> => {
    try {
      Alert.alert(
        'Fonctionnalité à venir',
        'La connexion Apple sera disponible dans une prochaine mise à jour.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      handleAuthError(error, 'Erreur lors de la connexion Apple');
    }
  }, [handleAuthError]);

  const sendPhoneCode = useCallback(async (
    phoneE164: string,
    appVerifier: ApplicationVerifier,
  ): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, error: null }));
      const confirmation = await signInWithPhoneNumber(auth, phoneE164, appVerifier);
      phoneConfirmationRef.current = confirmation;
      console.log(`📱 SMS OTP envoyé vers ${phoneE164}`);
    } catch (error) {
      phoneConfirmationRef.current = null;
      if (isRecaptchaCancelled(error)) {
        throw recaptchaCancelledError();
      }
      handleAuthError(error, 'Impossible d\'envoyer le SMS');
      throw error;
    }
  }, [handleAuthError]);

  const confirmPhoneCode = useCallback(async (
    code: string,
  ): Promise<{ needsProfileName: boolean }> => {
    const confirmation = phoneConfirmationRef.current;
    if (!confirmation) {
      throw new Error('Aucun code SMS en attente. Renvoyez un nouveau code.');
    }

    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      const userCredential = await confirmation.confirm(code.trim());
      const firebaseUser = userCredential.user;
      const profile = await loadUserProfile(firebaseUser, 'phone', 'customer');
      phoneConfirmationRef.current = null;

      setAuthState({
        user: firebaseUserToAuthUser(firebaseUser),
        userProfile: profile,
        isLoading: false,
        error: null,
      });

      const needsProfileName = profileNeedsDisplayName(
        profile,
        firebaseUser.phoneNumber || profile.phoneNumber,
      );
      console.log(
        `✅ Connexion téléphone — rôle: ${profile.role} — ${firebaseUser.phoneNumber}` +
          (needsProfileName ? ' — nom à renseigner' : ''),
      );
      return { needsProfileName };
    } catch (error) {
      const errorMessage = handleAuthError(error, 'Code SMS invalide');
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw new Error(errorMessage);
    }
  }, [firebaseUserToAuthUser, handleAuthError, loadUserProfile]);

  const completePhoneProfile = useCallback(async (fullName: string): Promise<void> => {
    const trimmed = fullName.trim().replace(/\s+/g, ' ');
    if (trimmed.length < 2) {
      throw new Error('Saisissez votre nom et prénom.');
    }
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      throw new Error('Utilisateur non connecté');
    }

    try {
      await updateProfile(firebaseUser, { displayName: trimmed });
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        displayName: trimmed,
        name: trimmed,
        updatedAt: Timestamp.now(),
      });
      const refreshed = auth.currentUser ?? firebaseUser;
      setAuthState(prev => ({
        ...prev,
        user: firebaseUserToAuthUser(refreshed),
        userProfile: prev.userProfile
          ? {
              ...prev.userProfile,
              displayName: trimmed,
              name: trimmed,
              updatedAt: Timestamp.now(),
            }
          : prev.userProfile,
      }));
      console.log(`✅ Nom du profil téléphone enregistré: ${trimmed}`);
    } catch (error) {
      const errorMessage = handleAuthError(error, 'Impossible d’enregistrer le nom');
      throw new Error(errorMessage);
    }
  }, [firebaseUserToAuthUser, handleAuthError]);

  const clearPhoneChallenge = useCallback(() => {
    phoneConfirmationRef.current = null;
  }, []);

  // Déconnexion
  const logout = useCallback(async (): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      console.log(`👋 Déconnexion de l'utilisateur: ${authState.user?.email}`);
      await signOut(auth);
      
      setAuthState({
        user: null,
        userProfile: null,
        isLoading: false,
        error: null
      });
      
      console.log('✅ Déconnexion réussie');
    } catch (error) {
      const errorMessage = handleAuthError(error, 'Erreur lors de la déconnexion');
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw new Error(errorMessage);
    }
  }, [authState.user?.email, handleAuthError]);

  // Mettre à jour le profil
  const updateUserProfile = useCallback(async (updates: Partial<UserProfile>): Promise<void> => {
    if (!authState.user) {
      throw new Error('Utilisateur non connecté');
    }

    try {
      // PROTECTION : Ne pas permettre la modification du rôle via cette fonction
      if (updates.role && updates.role !== authState.userProfile?.role) {
        console.warn('⚠️ Tentative de modification de rôle bloquée via updateUserProfile');
        delete updates.role;
      }
      
      const updatedProfile = {
        ...authState.userProfile,
        ...updates,
        updatedAt: Timestamp.now()
      } as UserProfile;

      const cleanUpdates = cleanFirestoreData(updatedProfile);
      await updateDoc(doc(db, 'users', authState.user.uid), cleanUpdates);
      
      setAuthState(prev => ({ ...prev, userProfile: updatedProfile }));
      
      console.log('✅ Profil mis à jour (sans modification de rôle)');

    } catch (error) {
      const errorMessage = handleAuthError(error, 'Erreur lors de la mise à jour du profil');
      throw new Error(errorMessage);
    }
  }, [authState.user, authState.userProfile, cleanFirestoreData, handleAuthError]);

  // Vérifier les rôles
  const hasRole = useCallback((role: UserRole | UserRole[]): boolean => {
    if (Array.isArray(role)) {
      return role.includes(userRole);
    }
    return userRole === role;
  }, [userRole]);

  // Vérifier les permissions
  const hasPermission = useCallback((permission: string): boolean => {
    if (!authState.userProfile) return false;
    if (isSuperAdmin) return true;
    
    const permissions = ROLE_PERMISSIONS[userRole];
    return permissions.includes('*') || permissions.includes(permission);
  }, [authState.userProfile, isSuperAdmin, userRole]);

  // Gestion de la réponse Google
  useEffect(() => {
    if (response?.type === 'error') {
      handleAuthError(response.error, 'Erreur d\'authentification Google');
    }
  }, [response, handleAuthError]);

  // 🔥 Initialisation robuste
  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    const initializeAuth = async () => {
      try {
        console.log('🔥 Initialisation AuthProvider...');
        
        unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (!isMounted) return;
          
          console.log('🔄 Firebase Auth State Changed:', 
            firebaseUser ? `User: ${firebaseUser.email} (${firebaseUser.uid})` : 'No user');
          
          if (firebaseUser) {
            try {
              // 🔥 CORRECTION DÉFINITIVE : Charger le profil
              const profile = await loadUserProfile(firebaseUser);
              const authUser = firebaseUserToAuthUser(firebaseUser);
              
              if (isMounted) {
                setAuthState({
                  user: authUser,
                  userProfile: profile,
                  isLoading: false,
                  error: null
                });
                
                console.log(`✅ Auth State mis à jour - Rôle: ${profile.role} - UID: ${firebaseUser.uid}`);
                
                // 🔥 VÉRIFICATION DE SÉCURITÉ : Alerter si un super-admin devient autre chose
                if (profile.role !== 'super-admin' && firebaseUser.email?.includes('admin')) {
                  console.warn(`⚠️ ATTENTION: Utilisateur admin avec rôle: ${profile.role}`);
                }
              }
            } catch (profileError) {
              console.error('❌ Erreur chargement profil:', profileError);
              if (isMounted) {
                setAuthState(prev => ({
                  ...prev,
                  user: firebaseUserToAuthUser(firebaseUser),
                  userProfile: null,
                  isLoading: false
                }));
              }
            }
          } else {
            if (isMounted) {
              setAuthState({
                user: null,
                userProfile: null,
                isLoading: false,
                error: null
              });
              console.log('👤 Aucun utilisateur connecté');
            }
          }
        });
        
        // Attendre un peu pour laisser Firebase se stabiliser
        setTimeout(() => {
          if (isMounted && authState.isLoading) {
            console.log('⏱️ Timeout chargement auth, passage en mode non-chargé');
            setAuthState(prev => ({ ...prev, isLoading: false }));
          }
        }, 5000);
        
      } catch (error) {
        console.error('❌ Erreur initialisation auth:', error);
        if (isMounted) {
          setAuthState(prev => ({ ...prev, isLoading: false }));
        }
      }
    };

    initializeAuth();

    return () => {
      console.log('🧹 Nettoyage AuthProvider');
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [firebaseUserToAuthUser, loadUserProfile]);

  const value: AuthContextType = {
    user: authState.user,
    userProfile: authState.userProfile,
    userRole,
    isLoading: authState.isLoading,
    isAuthenticated,
    isGuest,
    authError: authState.error,
    
    login,
    register,
    logout,
    updateUserProfile,
    
    signInWithGoogle,
    signInWithApple,
    sendPhoneCode,
    confirmPhoneCode,
    completePhoneProfile,
    clearPhoneChallenge,
    
    clearError,
    refreshUserProfile,
    updateEmailVerification,
    isPhoneProvider,
    
    isSuperAdmin,
    isAdmin,
    isSeller,
    isCustomer,
    hasRole,
    hasPermission,
    
    debugLogState
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook useAuth
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Hook utilitaire pour vérifier l'authentification
export const useAuthGuard = (requiredRole?: UserRole | UserRole[]): boolean => {
  const { isAuthenticated, userRole, hasRole, isLoading } = useAuth();
  
  if (isLoading) return false;
  if (!isAuthenticated) return false;
  if (!requiredRole) return true;
  
  return hasRole(requiredRole);
};

// 🔥 FONCTION DE DÉPANNAGE : Réparer manuellement un rôle
export const useRoleRepair = () => {
  const { user } = useAuth();

  const repairUserRole = useCallback(async (_correctRole: UserRole): Promise<void> => {
    if (!user) {
      throw new Error('Utilisateur non connecté');
    }
    throw new Error(
      'Le rôle ne peut plus être modifié depuis le client. Utiliser la Cloud Function setUserRole.',
    );
  }, [user]);

  return { repairUserRole };
};
