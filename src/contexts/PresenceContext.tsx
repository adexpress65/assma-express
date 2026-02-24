// src/contexts/PresenceContext.tsx
import React, { createContext, useContext, useEffect } from 'react';
import { doc, onDisconnect, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';

interface PresenceContextType {
  onlineUsers: string[];
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export const PresenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.uid) return;

    const userStatusRef = doc(db, 'status', user.uid);
    
    // Marquer comme en ligne
    setDoc(userStatusRef, {
      state: 'online',
      lastChanged: serverTimestamp(),
      uid: user.uid
    });

    // Configurer le disconnect
    onDisconnect(userStatusRef).set({
      state: 'offline',
      lastChanged: serverTimestamp(),
      uid: user.uid
    });

    return () => {
      // Nettoyage
    };
  }, [user?.uid]);

  return (
    <PresenceContext.Provider value={{ onlineUsers: [] }}>
      {children}
    </PresenceContext.Provider>
  );
};