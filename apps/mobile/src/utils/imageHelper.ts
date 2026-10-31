export const getSafeFirebaseUri = (uri: any) => {
  if (!uri || typeof uri !== 'string') return null;

  try {
    // 1. Nettoyage des espaces et décodage
    let clean = decodeURIComponent(uri.trim().replace(/[\s\u0000-\u001F\u007F-\u009F\uFEFF]+/g, ''));

    // 2. Reconstruction pour Firebase (Fonctionne pour /products, /chats, /users, etc.)
    if (clean.includes('firebasestorage.googleapis.com')) {
      // On extrait le nom du fichier et les paramètres (token, alt)
      const parts = clean.split('/o/');
      if (parts.length > 1) {
        const baseUrl = parts[0] + '/o/';
        const fullPath = parts[1].split('?')[0]; // ex: "products/ID/image.jpg"
        const params = parts[1].split('?')[1];   // ex: "alt=media&token=..."
        
        // On récupère le nom du fichier final (après le dernier slash du chemin)
        const pathSegments = fullPath.split('/');
        const folder = pathSegments[0]; // "products" ou "chats"
        const fileName = pathSegments[pathSegments.length - 1];

        // On ré-encode uniquement le slash entre le dossier et le fichier
        return `${baseUrl}${folder}%2F${fileName}?${params}`;
      }
    }
    return clean;
  } catch (e) {
    return uri;
  }
};