import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { resolveAuthorizedRole } from '@/utils/resolveAuthRole';

export type UserRole = 'super-admin' | 'admin' | 'seller' | 'customer' | null;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          const firestoreRole = userDoc.exists() ? userDoc.data()?.role : undefined;
          const role = await resolveAuthorizedRole(firebaseUser, firestoreRole);
          setUser(firebaseUser);
          setUserRole(role);
        } catch (error) {
          console.error('Erreur chargement rôle:', error);
          setUser(firebaseUser);
          setUserRole('customer');
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return { user, userRole, loading };
}
