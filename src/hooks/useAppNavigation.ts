// apps/mobile/src/hooks/useAppNavigation.ts
import { useRouter } from 'expo-router';

// Fonction utilitaire pour les noms de catégories
const getCategoryNameFromId = (categoryId: string): string => {
  const categoryMap: { [key: string]: string } = {
    'machines_industrielles': 'Machines Industrielles',
    'electronique': 'Électronique',
    'vetements': 'Vêtements',
    'alimentation': 'Alimentation',
    'construction': 'Construction',
    'sante': 'Santé & Médical',
    'beaute': 'Beauté & Cosmétiques',
    'sports': 'Sports & Fitness',
    'maison': 'Maison & Décoration',
    'automobile': 'Automobile',
    'trending': 'Produits Tendances',
    'new-arrivals': 'Nouveautés',
    'special-offers': 'Offres Spéciales',
    'machines': 'Machines Industrielles',
    'industrial_machines': 'Machines Industrielles',
    'electronics': 'Électronique',
    'clothing': 'Vêtements',
    'food': 'Alimentation',
    'health': 'Santé & Médical',
    'beauty': 'Beauté & Cosmétiques',
    'sport': 'Sports & Fitness',
    'home': 'Maison & Décoration',
    'auto': 'Automobile'
  };
  
  return categoryMap[categoryId] || categoryMap[categoryId?.toLowerCase()] || 'Catégorie Générale';
};

export default function useAppNavigation() {
  const router = useRouter();

  const navigateTo = {
    home: () => router.push('/(tabs)'),
    products: () => router.push('/products'),
    
    // ✅ NAVIGATION EN 2 ÉTAPES
    productDetail: (id: string, categoryId?: string) => {
      console.log('🔄 Navigation en 2 étapes vers produit:', id);
      
      // Étape 1: Aller à la catégorie avec produit présélectionné
      router.push({
        pathname: '/category/[id]',
        params: { 
          id: categoryId || 'all',
          name: encodeURIComponent(getCategoryNameFromId(categoryId || 'all')),
          preselectedProductId: id
        }
      });
    },
    
    // ✅ NAVIGATION DIRECTE AU PRODUIT (si vraiment nécessaire)
    productDetailDirect: (id: string) => {
      router.push(`/product/${id}`);
    },
    
    // ✅ NAVIGATION VERS CATÉGORIE
    category: (id: string, name?: string) => {
      router.push({
        pathname: '/category/[id]',
        params: { 
          id,
          name: encodeURIComponent(name || getCategoryNameFromId(id))
        }
      });
    },
    
    seller: {
      dashboard: () => router.push('/seller/dashboard'),
      addProduct: () => router.push('/seller/add-product'),
      products: () => router.push('/seller/products'),
      analytics: () => router.push('/seller/analytics'),
    },
    
    admin: {
      dashboard: () => router.push('/super-admin/dashboard'),
      sellers: () => router.push('/super-admin/sellers'),
      addProduct: () => router.push('/super-admin/add-product'),
    },
    
    auth: {
      login: () => router.push('/auth/login'),
      register: () => router.push('/auth/register'),
    },
    
    // ✅ NOUVEAUX ÉCRANS
    company: (id: string, name?: string) => {
      router.push({
        pathname: '/company/[id]',
        params: { 
          id,
          name: encodeURIComponent(name || 'Compagnie')
        }
      });
    },
    
    chat: (sellerId: string, _productId?: string, sellerName?: string) => {
      router.push({
        pathname: "/company/[id]",
        params: {
          id: sellerId,
          name: encodeURIComponent(sellerName || "Vendeur"),
        },
      });
    },
    
    cart: () => router.push('/cart'),
    orders: () => router.push('/orders'),
    profile: () => router.push('/profile'),
    live: (liveId?: string) => {
      router.push({
        pathname: '/live',
        params: { liveId: liveId || '' }
      });
    }
  };

  return { navigateTo, router };
}
