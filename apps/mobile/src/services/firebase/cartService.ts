// apps/mobile/src/services/firebase/cartService.ts
export const addToCart = async (item: any): Promise<any> => {
  console.log('📦 Add to cart (demo):', item);
  // Implémentation temporaire
  return { 
    success: true, 
    id: 'temp-cart-' + Date.now(),
    message: 'Produit ajouté au panier (mode démo)'
  };
};

export const getCart = async () => {
  return [];
};

export const updateCartItem = async (itemId: string, quantity: number) => {
  return { success: true };
};

export const removeFromCart = async (itemId: string) => {
  return { success: true };
};