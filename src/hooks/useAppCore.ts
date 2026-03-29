import { useState, useEffect, createContext, useContext } from 'react';
import { db, auth } from '../config/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

const AppContext = createContext<any>(null);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [data, setData] = useState({
    products: [],
    userProfile: null,
    loading: true
  });

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // ✅ ÉCOUTE EN TEMPS RÉEL (Zéro latence)
    // Au lieu de "getDocs", on utilise "onSnapshot". 
    // Si une donnée change sur Firebase, l'app se met à jour SANS RECHARGER.
    const q = query(collection(db, 'products'), where('companyId', '==', user.uid));
    
    const unsub = onSnapshot(q, (snapshot) => {
      const pList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setData(prev => ({ ...prev, products: pList, loading: false }));
    });

    return () => unsub();
  }, []);

  return (
    <AppContext.Provider value={data}>
      {children}
    </AppContext.Provider>
  );
};

// Hook pour utiliser les données n'importe où
export const useAppCore = () => useContext(AppContext);