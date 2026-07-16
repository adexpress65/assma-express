// apps/mobile/src/contexts/AuthContext.tsx - VERSION FINALE CORRIGÉE
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
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
  AuthError
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { setSentryUser } from '@/config/sentry';
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
  emailVerified: boolean;
  providerData: any[];
}

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isActive: boolean;
  phoneNumber?: string;
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
  authError: string | null;
  
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string, role?: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  
  clearError: () => void;
  
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isSeller: boolean;
  isCustomer: boolean;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  hasPermission: (permission: string) => boolean;
  
  refreshUserProfile: () => Promise<void>;
  updateEmailVerification: () => Promise<void>;
  
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
const VALID_CREATION_ROLES: UserRole[] = ['customer', 'seller', 'admin'];

const normalizeStoredRole = (role: unknown): UserRole | null => {
  const raw = String(role ?? '').trim().toLowerCase();
  if (['super-admin', 'super_admin', 'superadmin', 'super admin'].includes(raw)) return 'super-admin';
  if (raw === 'admin') return 'admin';
  if (raw === 'seller') return 'seller';
  if (raw === 'customer') return 'customer';
  if (raw === 'visitor') return 'visitor';
  return null;
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
  const isSuperAdmin = userRole === 'super-admin';
  const isAdmin = userRole === 'admin';
  const isSeller = userRole === 'seller';
  const isCustomer = userRole === 'customer';

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
          default:
            errorMessage = authError.message || defaultMessage;
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
    uid: string, 
    email: string, 
    displayName: string, 
    role: UserRole = 'customer',
    provider?: string
  ): UserProfile => {
    const now = Timestamp.now();
    
    const profile: UserProfile = {
      uid,
      email,
      displayName,
      role,
      createdAt: now,
      updatedAt: now,
      isActive: true,
      lastLogin: now
    };

    if (provider) {
      profile.providerId = provider;
      profile.socialAccounts = { [provider.toLowerCase()]: true };
    }

    // Ajouter des infos selon le rôle
    if (role === 'seller') {
      profile.sellerInfo = {
        shopName: displayName,
        isVerified: false,
        rating: 0,
        totalSales: 0,
        businessType: 'individual'
      };
    } else if (role === 'admin' || role === 'super-admin') {
      profile.adminInfo = {
        permissions: ROLE_PERMISSIONS[role],
        department: 'Administration',
        accessLevel: role === 'super-admin' ? 100 : 50
      };
    }

    return profile;
  }, []);

// 🔥 VERSION HYBRIDE SÉCURISÉE : SANS FILTRE STRICT ET ADAPTÉE POUR APPLE
const loadUserProfile = useCallback(async (firebaseUser: User, provider?: string): Promise<UserProfile> => {
  try {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const existingData = userDoc.data();
      
      // Si le document existe mais n'a pas de champ rôle, on met customer par défaut
      if (!existingData.role) {
        console.warn(`⚠️ Document existant sans champ 'role' pour UID: ${firebaseUser.uid}`);
        const updates = {
          role: 'customer',
          lastLogin: Timestamp.now(),
          updatedAt: Timestamp.now()
        };
        await updateDoc(userRef, updates);
        return {
          ...existingData,
          role: 'customer',
          lastLogin: updates.lastLogin,
          updatedAt: updates.updatedAt
        } as UserProfile;
      }
      
      // Préparer la mise à jour de l'activité
      const updates: Record<string, any> = {
        lastLogin: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      
      // Gestion propre du provider social (ex: pour Apple ou Google)
      if (provider) {
        updates['providerId'] = provider;
        updates[`socialAccounts.${provider.toLowerCase()}`] = true;
      }
      
      await updateDoc(userRef, updates);
      
      // On reprend STRICTEMENT le rôle stocké dans Firestore sans le filtrer ni le modifier
      const profile: UserProfile = {
        uid: firebaseUser.uid,
        email: existingData.email || firebaseUser.email || '',
        displayName: existingData.displayName || firebaseUser.displayName || 'Utilisateur',
        role: existingData.role, // 🔥 GARDE LA VALEUR BRUTE DE FIRESTORE ('super-admin')
        createdAt: existingData.createdAt || Timestamp.now(),
        updatedAt: updates.updatedAt,
        isActive: existingData.isActive !== false,
        lastLogin: updates.lastLogin,
        phoneNumber: existingData.phoneNumber || '',
        address: existingData.address || '',
        providerId: provider || existingData.providerId || '',
        socialAccounts: existingData.socialAccounts || {},
        sellerInfo: existingData.sellerInfo,
        adminInfo: existingData.adminInfo,
        companyId: existingData.companyId
      };
      
      if (provider) {
        profile.socialAccounts = {
          ...profile.socialAccounts,
          [provider.toLowerCase()]: true
        };
      }
      
      console.log(`✅ [Auth] Profil chargé avec succès - Rôle appliqué : ${profile.role}`);
      return profile;
      
    } else {
  // NOUVEAU COMPTE (ex: Première inscription ou premier Sign In With Apple)
  console.log(`🆕 Création nouveau profil - UID: ${firebaseUser.uid}`);

  // ⚠️ Définir ici ton super admin (à adapter)
  const isSuperAdmin = firebaseUser.email === "ton-email@exemple.com";
  const defaultRole = isSuperAdmin ? "super-admin" : "customer";

  const defaultProfile = createDefaultProfile(
    firebaseUser.uid,
    firebaseUser.email || '',
    firebaseUser.displayName || 'Utilisateur',
    defaultRole,
    provider
  );

  const cleanProfile = cleanFirestoreData(defaultProfile);
  await setDoc(userRef, cleanProfile);

  console.log(`✅ Nouveau profil créé avec rôle: ${defaultRole}`);
  return defaultProfile;
}
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

      // Envoyer email de vérification
      await sendEmailVerification(firebaseUser);

      // Vérifier si le document existe déjà
      const userRef = doc(db, 'users', firebaseUser.uid);
      const existingDoc = await getDoc(userRef);
      
      if (existingDoc.exists()) {
        console.warn(`⚠️ Document utilisateur existe déjà pour UID: ${firebaseUser.uid}`);
        const existingProfile = await loadUserProfile(firebaseUser);
        
        const authUser = firebaseUserToAuthUser(firebaseUser);
        setAuthState({
          user: authUser,
          userProfile: existingProfile,
          isLoading: false,
          error: null
        });
        
        console.log(`✅ Utilisateur existant reconnecté - Rôle: ${existingProfile.role}`);
        return;
      }

      // Créer le nouveau profil Firestore
      const userProfile = createDefaultProfile(
        firebaseUser.uid,
        email,
        displayName,
        role
      );

      const cleanProfile = cleanFirestoreData(userProfile);
      await setDoc(userRef, cleanProfile);

      const authUser = firebaseUserToAuthUser(firebaseUser);

      setAuthState({
        user: authUser,
        userProfile,
        isLoading: false,
        error: null
      });

      console.log(`✅ Utilisateur créé - Rôle: ${role} - Vérification email envoyée`);
      
    } catch (error) {
      const errorMessage = handleAuthError(error, 'Erreur lors de l\'inscription');
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw new Error(errorMessage);
    }
  }, [cleanFirestoreData, createDefaultProfile, firebaseUserToAuthUser, handleAuthError, loadUserProfile]);

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

  // Connexion Facebook
  const signInWithFacebook = useCallback(async (): Promise<void> => {
    try {
      Alert.alert(
        'Fonctionnalité à venir',
        'La connexion Facebook sera disponible dans une prochaine mise à jour.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      handleAuthError(error, 'Erreur lors de la connexion Facebook');
    }
  }, [handleAuthError]);

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
    authError: authState.error,
    
    login,
    register,
    logout,
    updateUserProfile,
    
    signInWithGoogle,
    signInWithFacebook,
    signInWithApple,
    
    clearError,
    refreshUserProfile,
    updateEmailVerification,
    
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
  const { user, refreshUserProfile } = useAuth();
  
  const repairUserRole = useCallback(async (correctRole: UserRole): Promise<void> => {
    if (!user) {
      throw new Error('Utilisateur non connecté');
    }
    
    try {
      console.log(`🔧 Réparation manuelle du rôle pour ${user.email}`);
      console.log(`Ancien rôle: ${user.role} -> Nouveau rôle: ${correctRole}`);
      
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        role: correctRole,
        updatedAt: Timestamp.now()
      });
      
      console.log(`✅ Rôle réparé: ${correctRole}`);
      
      // Rafraîchir le profil
      await refreshUserProfile();
      
    } catch (error) {
      console.error('❌ Erreur réparation rôle:', error);
      throw error;
    }
  }, [user, refreshUserProfile]);
  
  return { repairUserRole };
};
