import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth'; //  ¿ SUPPRIMER (Auth centralisÈ) //  ¿ SUPPRIMER (Auth centralisÈ)
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export type UserRole = 'super-admin' | 'admin' | 'seller' | 'customer' | null;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // R√©cup√©rer le r√¥le depuis Firestore
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser(user);
            setUserRole(userData.role || 'customer');
          } else {
            setUser(user);
            setUserRole('customer');
          }
        } catch (error) {
          console.error('Erreur chargement r√¥le:', error);
          setUser(user);
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
