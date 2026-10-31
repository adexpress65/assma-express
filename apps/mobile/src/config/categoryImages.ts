// src/config/categoryImages.ts
export const CATEGORY_BANNERS: Record<string, string> = {
  // ✅ VOS URLS FIXES - MODIFIEZ CES LIENS
  'electronique': 'https://assmaexpress.com/images/categories/electronics-banner.jpg',
  'electroniques': 'https://assmaexpress.com/images/categories/electronics-banner.jpg',
  'electronics': 'https://assmaexpress.com/images/categories/electronics-banner.jpg',
  
  'vetements': 'https://assmaexpress.com/images/categories/clothing-banner.jpg',
  'clothing': 'https://assmaexpress.com/images/categories/clothing-banner.jpg',
  'apparel': 'https://assmaexpress.com/images/categories/clothing-banner.jpg',
  
  'machines': 'https://assmaexpress.com/images/categories/machinery-banner.jpg',
  'machinery': 'https://assmaexpress.com/images/categories/machinery-banner.jpg',
  'industrial': 'https://assmaexpress.com/images/categories/machinery-banner.jpg',
  
  'materiaux': 'https://assmaexpress.com/images/categories/materials-banner.jpg',
  'materials': 'https://assmaexpress.com/images/categories/materials-banner.jpg',
  'construction': 'https://assmaexpress.com/images/categories/materials-banner.jpg',
  
  'automobile': 'https://assmaexpress.com/images/categories/automotive-banner.jpg',
  'automotive': 'https://assmaexpress.com/images/categories/automotive-banner.jpg',
  'auto': 'https://assmaexpress.com/images/categories/automotive-banner.jpg',
  
  'medical': 'https://assmaexpress.com/images/categories/medical-banner.jpg',
  'medicaux': 'https://assmaexpress.com/images/categories/medical-banner.jpg',
  'equipement-medical': 'https://assmaexpress.com/images/categories/medical-banner.jpg',
  
  'meubles': 'https://assmaexpress.com/images/categories/furniture-banner.jpg',
  'furniture': 'https://assmaexpress.com/images/categories/furniture-banner.jpg',
  'home': 'https://assmaexpress.com/images/categories/furniture-banner.jpg',
  
  'jardinage': 'https://assmaexpress.com/images/categories/gardening-banner.jpg',
  'gardening': 'https://assmaexpress.com/images/categories/gardening-banner.jpg',
  'garden': 'https://assmaexpress.com/images/categories/gardening-banner.jpg',
  
  // ✅ DÉFAUT - IMPORTANT
  'default': 'https://assmaexpress.com/images/categories/default-banner.jpg',
  'tous': 'https://assmaexpress.com/images/categories/default-banner.jpg',
  'all': 'https://assmaexpress.com/images/categories/default-banner.jpg',
};

// Fonction pour obtenir l'URL d'une catégorie
export const getCategoryBanner = (categoryId: string): string => {
  const normalizedId = categoryId.toLowerCase().trim();
  return CATEGORY_BANNERS[normalizedId] || CATEGORY_BANNERS.default;
};

// Fonction pour formater le nom de catégorie
export const formatCategoryName = (id: string): string => {
  return id
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
