import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { auth } from '../config/firebase';

interface AuthContextType {
  user: User | null;
  userRole: 'customer' | 'seller' | 'admin' | 'super-admin';
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string, role?: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  updateUserRole: (role: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'customer' | 'seller' | 'admin' | 'super-admin'>('customer');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      
      // Déterminer le rôle de l'utilisateur
      if (user) {
        // Ici vous pouvez récupérer le rôle depuis Firestore ou utiliser l'email pour déterminer le rôle
        const email = user.email || '';
        if (email.includes('admin') || email.includes('super')) {
          setUserRole('super-admin');
        } else if (email.includes('seller')) {
          setUserRole('seller');
        } else {
          setUserRole('customer');
        }
      } else {
        setUserRole('customer');
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Erreur connexion:', error);
      throw error;
    }
  };

  const register = async (email: string, password: string, displayName: string, role: string = 'customer') => {
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName });
      setUserRole(role as any);
    } catch (error) {
      console.error('Erreur inscription:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUserRole('customer');
    } catch (error) {
      console.error('Erreur déconnexion:', error);
      throw error;
    }
  };

  const updateUserRole = (role: string) => {
    setUserRole(role as any);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      userRole, 
      login, 
      register, 
      logout, 
      loading,
      updateUserRole 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
