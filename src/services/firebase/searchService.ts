// services/firebase/searchService.ts
import { collection, query, where, getDocs, limit, orderBy, startAt, endAt } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Product } from './productsService';

export interface SearchResult {
  id: string;
  type: 'product' | 'category' | 'company' | 'supplier';
  name: string;
  price?: number;
  currency?: string;
  supplier?: string;
  companyName?: string;
  companyId?: string;
  featured?: boolean;
  imageUrl?: string;
  category?: string;
  rating?: number;
  reviewCount?: number;
}

export class SearchService {
  // Fonction utilitaire pour obtenir l'image d'un produit
  static getProductImage(product: Product | any): string {
    if (product?.mainImage) return product.mainImage;
    if (product?.imageUrl) return product.imageUrl;
    if (product?.images?.[0]) return product.images[0];
    if (product?.image) return product.image;
    
    // Fallback par défaut basé sur le type
    const categoryName = product?.categoryName?.toLowerCase() || '';
    if (categoryName.includes('mode') || categoryName.includes('vetement')) {
      return 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&h=400&fit=crop';
    }
    if (categoryName.includes('electronique') || categoryName.includes('tech')) {
      return 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&h=400&fit=crop';
    }
    if (categoryName.includes('maison') || categoryName.includes('jardin')) {
      return 'https://images.unsplash.com/photo-1615529328331-f8917597711f?w=400&h=400&fit=crop';
    }
    
    return 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=400&fit=crop';
  }

  // Normalisation des termes de recherche (gestion singulier/pluriel)
  private static normalizeSearchTerm(term: string): string {
    const normalized = term.toLowerCase().trim();
    
    // Dictionnaire de transformations singulier/pluriel
    const pluralToSingular: Record<string, string> = {
      'chaussures': 'chaussure',
      'vetements': 'vetement',
      'produits': 'produit',
      'sacs': 'sac',
      'montres': 'montre',
      'telephones': 'telephone',
      'ordinateurs': 'ordinateur',
      'meubles': 'meuble',
      'accessoires': 'accessoire',
      'livres': 'livre',
      'jouets': 'jouet',
      'aliments': 'aliment',
    };

    const singularToPlural: Record<string, string> = {
      'chaussure': 'chaussures',
      'vetement': 'vetements',
      'produit': 'produits',
      'sac': 'sacs',
      'montre': 'montres',
      'telephone': 'telephones',
      'ordinateur': 'ordinateurs',
      'meuble': 'meubles',
      'accessoire': 'accessoires',
      'livre': 'livres',
      'jouet': 'jouets',
      'aliment': 'aliments',
    };

    // Vérifier si c'est au pluriel et obtenir le singulier
    const singular = pluralToSingular[normalized];
    if (singular) {
      return singular;
    }

    // Vérifier si c'est au singulier et obtenir le pluriel
    const plural = singularToPlural[normalized];
    if (plural) {
      return plural;
    }

    return normalized;
  }

  // Recherche générique de tous les produits
  static async searchAllProducts(
    searchTerm: string, 
    options?: { limit?: number }
  ): Promise<SearchResult[]> {
    try {
      if (!searchTerm.trim()) return [];

      const normalizedTerm = this.normalizeSearchTerm(searchTerm);
      const terms = normalizedTerm.split(' ').filter(t => t.length > 0);
      
      if (terms.length === 0) return [];

      const productsRef = collection(db, 'products');
      let queries = [];

      // Recherche par nom (contient plutôt que commence par)
      for (const term of terms) {
        if (term.length < 2) continue;
        
        // Recherche insensible à la casse et partielle
        const q = query(
          productsRef,
          where('name_lower', '>=', term),
          where('name_lower', '<=', term + '\uf8ff'),
          orderBy('name_lower'),
          limit(options?.limit || 20)
        );
        queries.push(getDocs(q));
      }

      // Recherche par catégorie
      if (terms.length > 0) {
        const mainTerm = terms[0];
        const categoryQuery = query(
          productsRef,
          where('categoryName_lower', '>=', mainTerm),
          where('categoryName_lower', '<=', mainTerm + '\uf8ff'),
          orderBy('categoryName_lower'),
          limit(10)
        );
        queries.push(getDocs(categoryQuery));
      }

      const results = await Promise.all(queries);
      const allProducts = new Map<string, any>();

      // Fusionner les résultats en évitant les doublons
      results.forEach(snapshot => {
        snapshot.forEach(doc => {
          const productData = doc.data();
          if (!allProducts.has(doc.id)) {
            allProducts.set(doc.id, {
              ...productData,
              id: doc.id
            });
          }
        });
      });

      // Convertir en SearchResult
      const searchResults: SearchResult[] = Array.from(allProducts.values())
        .map(product => ({
          id: product.id,
          type: 'product' as const,
          name: product.name || '',
          price: product.price || product.originalPrice,
          currency: product.currency || 'FCFA',
          supplier: product.supplier || product.companyName,
          companyName: product.companyName,
          companyId: product.companyId,
          featured: product.featured || product.premiumSupplier || false,
          imageUrl: this.getProductImage(product),
          category: product.categoryName,
          rating: product.rating || 0,
          reviewCount: product.reviewCount || 0
        }))
        .sort((a, b) => {
          // Prioriser les produits en vedette
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          
          // Puis par prix croissant
          return (a.price || 0) - (b.price || 0);
        })
        .slice(0, options?.limit || 10);

      return searchResults;

    } catch (error) {
      console.error('Erreur recherche produits:', error);
      return [];
    }
  }

  // Suggestions instantanées (pour l'auto-complétion)
  static async getInstantSuggestions(query: string): Promise<SearchResult[]> {
    if (query.length < 2) return [];
    
    const results = await this.searchAllProducts(query, { limit: 5 });
    
    // Ajouter des résultats de catégories populaires
    if (results.length < 3) {
      const popularCategories = [
        { id: 'mode', name: 'Mode & Accessoires', type: 'category' as const },
        { id: 'electronique', name: 'Électronique', type: 'category' as const },
        { id: 'maison', name: 'Maison & Jardin', type: 'category' as const },
        { id: 'beaute', name: 'Beauté & Santé', type: 'category' as const }
      ];

      const matchingCategories = popularCategories.filter(cat =>
        cat.name.toLowerCase().includes(query.toLowerCase())
      );

      matchingCategories.forEach(cat => {
        if (results.length < 5) {
          results.push({
            id: cat.id,
            type: cat.type,
            name: cat.name,
            imageUrl: cat.type === 'category' 
              ? 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400&h=300&fit=crop'
              : undefined
          });
        }
      });
    }

    return results;
  }
}