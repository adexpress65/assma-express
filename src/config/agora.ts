export const AGORA_CONFIG = {
  appId: 'ea81a94bdf524386aefc2506db451e31', // À obtenir sur console.agora.io
  token: null as string | null, // Généré côté serveur
  channelName: 'assma_live',
};

// Fonction pour générer un token (à implémenter côté serveur)
export const generateToken = async (channelName: string, uid: number) => {
  // Implémentez cette fonction avec votre backend
  return null;
};