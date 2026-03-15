// src/utils/firebaseImage.ts
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { storage } from '@/config/firebase';

// Cache pour les URLs téléchargées
const urlCache = new Map<string, string>();

export const getFirebaseImageUrl = async (path: string): Promise<string | null> => {
  try {
    // Vérifier le cache
    if (urlCache.has(path)) {
      return urlCache.get(path)!;
    }

    // Si c'est déjà une URL Firebase complète, extraire le chemin
    let storagePath = path;
    if (path.includes('firebasestorage.googleapis.com')) {
      // Essayer d'extraire le chemin du storage
      const matches = path.match(/o\/(.+?)\?/);
      if (matches && matches[1]) {
        storagePath = decodeURIComponent(matches[1]);
      } else {
        return path; // Retourner l'URL originale si on ne peut pas extraire
      }
    }

    // Créer une référence et obtenir l'URL de téléchargement
    const imageRef = ref(storage, storagePath);
    const downloadUrl = await getDownloadURL(imageRef);
    
    // Mettre en cache
    urlCache.set(path, downloadUrl);
    
    return downloadUrl;
  } catch (error) {
    console.error('Erreur récupération image Firebase:', error);
    return null;
  }
};