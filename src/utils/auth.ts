// apps/mobile/src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  FacebookAuthProvider,
  OAuthProvider
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../config/firebase';
import { UserProfile, UserRole } from '../types/auth';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signInWithApple: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER_TOKEN: 'user_token',
  USER_DATA: 'user_data',
  USER_PROFILE: 'user_profile'
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);

  // Sauvegarder les données dans AsyncStorage
  const saveToStorage = async (key: string, data: any) => {
    try {
      const jsonValue = JSON.stringify(data);
      await AsyncStorage.setItem(key, jsonValue);
    } catch (error) {
      console.error('Erreur sauvegarde AsyncStorage:', error);
    }
  };

  // Charger les données depuis AsyncStorage
  const loadFromStorage = async (key: string) => {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error('Erreur chargement AsyncStorage:', error);
      return null;
    }
  };

  // Supprimer les données de AsyncStorage
  const clearStorage = async () => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.USER_TOKEN,
        STORAGE_KEYS.USER_DATA,
        STORAGE_KEYS.USER_PROFILE
      ]);
    } catch (error) {
      console.error('Erreur nettoyage AsyncStorage:', error);
    }
  };

  // Charger le profil utilisateur depuis Firestore
  const loadUserProfile = async (uid: string): Promise<UserProfile | null> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        return userDoc.data() as UserProfile;
      }
      return null;
    } catch (error) {
      console.error('Erreur chargement profil:', error);
      return null;
    }
  };

  // Créer ou mettre à jour le profil utilisateur
  const createOrUpdateUserProfile = async (userData: User, role: UserRole = 'customer') => {
    try {
      const userProfileData: Partial<UserProfile> = {
        uid: userData.uid,
        email: userData.email || '',
        displayName: userData.displayName || userData.email?.split('@')[0] || 'Utilisateur',
        role,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        providerId: userData.providerData?.[0]?.providerId,
        phoneNumber: userData.phoneNumber || undefined,
        photoURL: userData.photoURL || undefined
      };

      const userRef = doc(db, 'users', userData.uid);
      await setDoc(userRef, userProfileData, { merge: true });

      const updatedProfile = await loadUserProfile(userData.uid);
      if (updatedProfile) {
        setUserProfile(updatedProfile);
        await saveToStorage(STORAGE_KEYS.USER_PROFILE, updatedProfile);
      }

      return updatedProfile;
    } catch (error) {
      console.error('Erreur création profil:', error);
      throw error;
    }
  };

  // Initialiser l'authentification au démarrage
  useEffect(() => {
    const initializeAuth = async () => {
      setIsInitializing(true);
      try {
        // Essayer de charger depuis le stockage local d'abord (pour performance)
        const storedUser = await loadFromStorage(STORAGE_KEYS.USER_DATA);
        const storedProfile = await loadFromStorage(STORAGE_KEYS.USER_PROFILE);
        
        if (storedUser) {
          setUser(storedUser);
          setUserProfile(storedProfile);
        }

        // Écouter les changements d'état d'authentification Firebase
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          console.log('🔥 Firebase auth state changed:', firebaseUser ? 'User logged in' : 'No user');
          
          if (firebaseUser) {
            // Utilisateur connecté dans Firebase
            setUser(firebaseUser);
            await saveToStorage(STORAGE_KEYS.USER_DATA, firebaseUser);
            
            // Charger ou créer le profil
            let profile = await loadUserProfile(firebaseUser.uid);
            if (!profile) {
              profile = await createOrUpdateUserProfile(firebaseUser);
            } else {
              // Mettre à jour la dernière connexion
              await updateDoc(doc(db, 'users', firebaseUser.uid), {
                lastLogin: serverTimestamp()
              });
              setUserProfile(profile);
              await saveToStorage(STORAGE_KEYS.USER_PROFILE, profile);
            }
          } else {
            // Utilisateur déconnecté
            setUser(null);
            setUserProfile(null);
            await clearStorage();
          }
          
          setIsLoading(false);
        });

        return unsubscribe;
      } catch (error) {
        console.error('Erreur initialisation auth:', error);
        setIsLoading(false);
      } finally {
        setIsInitializing(false);
      }
    };

    const unsubscribe = initializeAuth();
    return () => {
      if (unsubscribe instanceof Promise) {
        unsubscribe.then(unsub => unsub && unsub());
      }
    };
  }, []);

  // Connexion email/mot de passe
  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Les données seront gérées par onAuthStateChanged
      console.log('✅ Connexion réussie:', userCredential.user.email);
    } catch (error: any) {
      console.error('❌ Erreur connexion:', error);
      let errorMessage = 'Erreur de connexion';
      
      if (error.code === 'auth/invalid-credential') {
        errorMessage = 'Email ou mot de passe incorrect';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'Aucun compte avec cet email';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Trop de tentatives. Réessayez plus tard';
      }
      
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Inscription
  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      setIsLoading(true);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Mettre à jour le profil Firebase
      await updateProfile(userCredential.user, { displayName });
      
      // Créer le profil dans Firestore
      await createOrUpdateUserProfile(userCredential.user);
      
      console.log('✅ Inscription réussie:', userCredential.user.email);
    } catch (error: any) {
      console.error('❌ Erreur inscription:', error);
      let errorMessage = 'Erreur d\'inscription';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Cet email est déjà utilisé';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Le mot de passe est trop faible';
      }
      
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Déconnexion
  const signOut = async () => {
    try {
      setIsLoading(true);
      await firebaseSignOut(auth);
      
      // Les données seront effacées par onAuthStateChanged
      console.log('✅ Déconnexion réussie');
    } catch (error) {
      console.error('❌ Erreur déconnexion:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Réinitialiser mot de passe
  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      console.log('✅ Email de réinitialisation envoyé');
    } catch (error: any) {
      console.error('❌ Erreur réinitialisation:', error);
      throw new Error(error.message);
    }
  };

  // Mettre à jour le profil
  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!user) throw new Error('Utilisateur non connecté');
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      
      // Recharger le profil
      const updatedProfile = await loadUserProfile(user.uid);
      if (updatedProfile) {
        setUserProfile(updatedProfile);
        await saveToStorage(STORAGE_KEYS.USER_PROFILE, updatedProfile);
      }
      
      console.log('✅ Profil mis à jour');
    } catch (error) {
      console.error('❌ Erreur mise à jour profil:', error);
      throw error;
    }
  };

  // Connexion avec Google
  const signInWithGoogle = async () => {
    try {
      setIsLoading(true);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Vérifier si c'est un nouvel utilisateur
      const isNewUser = result.user.metadata.creationTime === result.user.metadata.lastSignInTime;
      
      if (isNewUser) {
        await createOrUpdateUserProfile(result.user);
      }
      
      console.log('✅ Connexion Google réussie');
    } catch (error: any) {
      console.error('❌ Erreur connexion Google:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Connexion avec Facebook
  const signInWithFacebook = async () => {
    try {
      setIsLoading(true);
      const provider = new FacebookAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      const isNewUser = result.user.metadata.creationTime === result.user.metadata.lastSignInTime;
      
      if (isNewUser) {
        await createOrUpdateUserProfile(result.user);
      }
      
      console.log('✅ Connexion Facebook réussie');
    } catch (error: any) {
      console.error('❌ Erreur connexion Facebook:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Connexion avec Apple
  const signInWithApple = async () => {
    try {
      setIsLoading(true);
      const provider = new OAuthProvider('apple.com');
      const result = await signInWithPopup(auth, provider);
      
      const isNewUser = result.user.metadata.creationTime === result.user.metadata.lastSignInTime;
      
      if (isNewUser) {
        await createOrUpdateUserProfile(result.user);
      }
      
      console.log('✅ Connexion Apple réussie');
    } catch (error: any) {
      console.error('❌ Erreur connexion Apple:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    user,
    userProfile,
    isLoading: isLoading || isInitializing,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updateUserProfile,
    signInWithGoogle,
    signInWithFacebook,
    signInWithApple
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};