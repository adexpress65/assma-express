// utils/firebaseImageUploadWithPicker.ts
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Alert } from 'react-native';

// Types
interface UploadOptions {
  maxFileSizeMB?: number;
  maxRetries?: number;
}

interface ImagePickerOptions {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
  allowsMultipleSelection?: boolean;
  mediaTypes?: ImagePicker.MediaType | ImagePicker.MediaType[];
}

const DEFAULT_UPLOAD_OPTIONS: UploadOptions = {
  maxFileSizeMB: 5,
  maxRetries: 3
};

const DEFAULT_PICKER_OPTIONS: ImagePickerOptions = {
  allowsEditing: true,
  aspect: [4, 3],
  quality: 0.7,
  allowsMultipleSelection: false,
  mediaTypes: ['images'],
};

// ✅ DEMANDER LES PERMISSIONS
export const requestMediaLibraryPermissions = async (): Promise<boolean> => {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Permission requise',
        'Désolé, nous avons besoin de la permission d\'accéder à votre galerie pour sélectionner des images.',
        [{ text: 'OK' }]
      );
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erreur permission galerie:', error);
    return false;
  }
};

export const requestCameraPermissions = async (): Promise<boolean> => {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Permission requise',
        'Désolé, nous avons besoin de la permission d\'accéder à votre caméra pour prendre des photos.',
        [{ text: 'OK' }]
      );
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erreur permission caméra:', error);
    return false;
  }
};

// ✅ SÉLECTIONNER DEPUIS LA GALERIE
export const pickImageFromGallery = async (
  options: ImagePickerOptions = {}
): Promise<string[]> => {
  try {
    const hasPermission = await requestMediaLibraryPermissions();
    if (!hasPermission) return [];

    const mergedOptions = { ...DEFAULT_PICKER_OPTIONS, ...options };
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mergedOptions.mediaTypes,
      allowsEditing: mergedOptions.allowsEditing,
      aspect: mergedOptions.aspect,
      quality: mergedOptions.quality,
      allowsMultipleSelection: mergedOptions.allowsMultipleSelection,
    });

    console.log('📸 Résultat ImagePicker:', result);

    if (result.canceled) {
      console.log('👤 Utilisateur a annulé la sélection');
      return [];
    }

    if (result.assets && result.assets.length > 0) {
      const uris = result.assets.map(asset => asset.uri);
      console.log(`✅ ${uris.length} image(s) sélectionnée(s)`);
      return uris;
    }

    return [];
  } catch (error) {
    console.error('❌ Erreur sélection galerie:', error);
    Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
    return [];
  }
};

// ✅ PRENDRE UNE PHOTO
export const takePhotoWithCamera = async (
  options: ImagePickerOptions = {}
): Promise<string[]> => {
  try {
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) return [];

    const mergedOptions = { ...DEFAULT_PICKER_OPTIONS, ...options };
    
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: mergedOptions.mediaTypes,
      allowsEditing: mergedOptions.allowsEditing,
      aspect: mergedOptions.aspect,
      quality: mergedOptions.quality,
    });

    console.log('📸 Résultat Camera:', result);

    if (result.canceled) {
      console.log('👤 Utilisateur a annulé la photo');
      return [];
    }

    if (result.assets && result.assets.length > 0) {
      const uris = result.assets.map(asset => asset.uri);
      console.log(`✅ ${uris.length} photo(s) prise(s)`);
      return uris;
    }

    return [];
  } catch (error) {
    console.error('❌ Erreur caméra:', error);
    Alert.alert('Erreur', 'Impossible de prendre la photo');
    return [];
  }
};

// ✅ UPLOAD SIMPLIFIÉ (sans compression supplémentaire)
const uploadImageToFirebase = async (
  uri: string,
  userId: string,
  options: UploadOptions = {}
): Promise<string> => {
  const mergedOptions = { ...DEFAULT_UPLOAD_OPTIONS, ...options };
  
  try {
    // Vérifier que le fichier existe
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error('Fichier non trouvé');
    }

    // Convertir en Blob
    const response = await fetch(uri);
    const blob = await response.blob();

    // Vérifier la taille
    const fileSizeMB = blob.size / (1024 * 1024);
    console.log(`📊 Taille image: ${fileSizeMB.toFixed(2)}MB`);
    
    if (fileSizeMB > mergedOptions.maxFileSizeMB!) {
      console.warn(`⚠️ Image lourde: ${fileSizeMB.toFixed(2)}MB (max: ${mergedOptions.maxFileSizeMB}MB)`);
      // Continuer quand même mais avertir
    }

    // Générer un nom unique
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const fileExtension = 'jpg';
    const fileName = `image_${timestamp}_${randomId}.${fileExtension}`;
    const storagePath = `uploads/${userId}/${fileName}`;

    // Upload vers Firebase
    const storage = getStorage();
    const storageRef = ref(storage, storagePath);

    const uploadTask = uploadBytesResumable(storageRef, blob);

    const downloadURL = await new Promise<string>((resolve, reject) => {
      const uploadPromise = new Promise<string>((innerResolve, innerReject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`📤 Upload: ${Math.round(progress)}%`);
          },
          (error) => {
            innerReject(error);
          },
          async () => {
            try {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              innerResolve(url);
            } catch (urlError) {
              innerReject(urlError);
            }
          }
        );
      });

      // Timeout après 45 secondes
      const timeout = setTimeout(() => {
        reject(new Error('Timeout upload'));
      }, 45000);

      uploadPromise
        .then((url) => {
          clearTimeout(timeout);
          resolve(url);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });

    console.log(`✅ Upload réussi: ${downloadURL.substring(0, 80)}...`);
    return downloadURL;

  } catch (error) {
    console.error('❌ Erreur upload:', error);
    throw error;
  }
};

// ✅ FONCTION PRINCIPALE - SÉLECTION + UPLOAD
export const pickAndUploadImages = async (
  userId: string,
  pickerOptions: ImagePickerOptions = {},
  uploadOptions: UploadOptions = {}
): Promise<string[]> => {
  try {
    console.log('🚀 Début processus sélection + upload...');

    // Sélectionner les images
    const imageUris = await pickImageFromGallery(pickerOptions);
    
    if (imageUris.length === 0) {
      console.log('👤 Aucune image sélectionnée');
      return [];
    }

    console.log(`📸 ${imageUris.length} image(s) à uploader`);

    // Uploader chaque image
    const uploadedUrls: string[] = [];
    
    for (let i = 0; i < imageUris.length; i++) {
      try {
        console.log(`🔄 Upload image ${i + 1}/${imageUris.length}...`);
        const downloadURL = await uploadImageToFirebase(imageUris[i], userId, uploadOptions);
        uploadedUrls.push(downloadURL);
      } catch (error) {
        console.error(`❌ Échec upload image ${i + 1}:`, error);
        // Continuer avec les autres images
      }
    }

    console.log(`🎉 Processus terminé: ${uploadedUrls.length}/${imageUris.length} images uploadées`);
    return uploadedUrls;

  } catch (error) {
    console.error('❌ Erreur processus complet:', error);
    Alert.alert('Erreur', 'Impossible de traiter les images');
    return [];
  }
};

// ✅ HOOK POUR L'UTILISATION DANS LES COMPOSANTS
import { useState } from 'react';

export const useImageUpload = () => {
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  // Sélectionner depuis la galerie
  const pickImages = async (options?: ImagePickerOptions): Promise<string[]> => {
    const uris = await pickImageFromGallery(options);
    setSelectedImages(uris);
    return uris;
  };

  // Prendre une photo
  const takePhoto = async (options?: ImagePickerOptions): Promise<string[]> => {
    const uris = await takePhotoWithCamera(options);
    setSelectedImages(uris);
    return uris;
  };

  // Uploader les images sélectionnées
  const uploadImages = async (
    userId: string,
    uploadOptions?: UploadOptions
  ): Promise<string[]> => {
    if (selectedImages.length === 0) {
      Alert.alert('Aucune image', 'Veuillez d\'abord sélectionner des images');
      return [];
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const uploadedUrls: string[] = [];
      
      for (let i = 0; i < selectedImages.length; i++) {
        try {
          setUploadProgress((i / selectedImages.length) * 100);
          const url = await uploadImageToFirebase(selectedImages[i], userId, uploadOptions);
          uploadedUrls.push(url);
        } catch (error) {
          console.error(`❌ Échec upload image ${i + 1}:`, error);
        }
      }

      setUploadProgress(100);
      
      // Nettoyer après upload
      setTimeout(() => {
        setSelectedImages([]);
        setIsUploading(false);
        setUploadProgress(0);
      }, 1000);

      return uploadedUrls;
    } catch (error) {
      setIsUploading(false);
      setUploadProgress(0);
      throw error;
    }
  };

  // Processus complet en une étape
  const pickAndUpload = async (
    userId: string,
    pickerOptions?: ImagePickerOptions,
    uploadOptions?: UploadOptions
  ): Promise<string[]> => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const urls = await pickAndUploadImages(userId, pickerOptions, uploadOptions);
      setUploadProgress(100);
      
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 1000);

      return urls;
    } catch (error) {
      setIsUploading(false);
      setUploadProgress(0);
      return [];
    }
  };

  return {
    // État
    uploadProgress,
    isUploading,
    selectedImages,
    hasSelectedImages: selectedImages.length > 0,
    
    // Actions
    pickImages,
    takePhoto,
    uploadImages,
    pickAndUpload,
    
    // Nettoyage
    clearSelection: () => setSelectedImages([]),
  };
};

// ✅ EXEMPLE D'UTILISATION DANS UN COMPOSANT
/*
import { useImageUpload } from '../utils/firebaseImageUploadWithPicker';

const MyComponent = () => {
  const { 
    pickAndUpload, 
    uploadProgress, 
    isUploading 
  } = useImageUpload();

  const handleUpload = async () => {
    const urls = await pickAndUpload('user123', {
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      allowsMultipleSelection: true
    });
    
    if (urls.length > 0) {
      console.log('URLs des images:', urls);
      // Utiliser les URLs dans votre application
    }
  };

  return (
    <View>
      <Button 
        title={isUploading ? `Upload... ${uploadProgress}%` : "Sélectionner des images"}
        onPress={handleUpload}
        disabled={isUploading}
      />
    </View>
  );
};
*/