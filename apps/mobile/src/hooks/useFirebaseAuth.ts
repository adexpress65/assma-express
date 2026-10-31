// apps/mobile/src/hooks/useFirebaseAuth.ts
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  setPersistence, 
  getReactNativePersistence,
  inMemoryPersistence 
} from 'firebase/auth'; //  � SUPPRIMER (Auth centralis�) //  � SUPPRIMER (Auth centralis�)
import { auth } from '../config/firebase';

export const useFirebaseAuthPersistence = () => {
  useEffect(() => {
    // Configurer la persistance APRÈS l'initialisation complète
    const configurePersistence = async () => {
      try {
        console.log('🔄 Configuration persistance AsyncStorage...');
        
        // Vérifier si AsyncStorage est disponible
        const testKey = 'firebase_test';
        await AsyncStorage.setItem(testKey, 'test');
        await AsyncStorage.removeItem(testKey);
        
        // Configurer la persistance
        await setPersistence(auth, getReactNativePersistence(AsyncStorage));
        console.log('✅ Persistance AsyncStorage configurée');
        
      } catch (error) {
        console.warn('⚠️ AsyncStorage non disponible:', error);
        
        try {
          // Fallback : persistance en mémoire
          await setPersistence(auth, inMemoryPersistence);
          console.log('⚠️ Utilisation persistance en mémoire');
        } catch (memoryError) {
          console.error('❌ Impossible de configurer la persistance:', memoryError);
        }
      }
    };

    // Laisser Firebase s'initialiser complètement
    setTimeout(() => {
      configurePersistence();
    }, 1000);
  }, []);
};
