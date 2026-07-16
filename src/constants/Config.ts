// apps/mobile/src/constants/Config.ts
import { COLORS } from './Theme';

export const ORDER_STATUS_CONFIG = {
  pending: { 
    label: 'À payer', 
    color: COLORS.warning, 
    icon: 'card-outline' as const,
    bgColor: 'rgba(255, 193, 7, 0.1)'
  },
  confirmed: { 
    label: 'À expédier', 
    color: COLORS.primary, 
    icon: 'cube-outline' as const,
    bgColor: 'rgba(255, 106, 0, 0.1)'
  },
  shipped: { 
    label: 'Expédié', 
    color: COLORS.info, 
    icon: 'car-outline' as const,
    bgColor: 'rgba(23, 162, 184, 0.1)'
  },
  delivered: { 
    label: 'Livré', 
    color: COLORS.success, 
    icon: 'checkmark-done-outline' as const,
    bgColor: 'rgba(40, 167, 69, 0.1)'
  },
  cancelled: { 
    label: 'Avis', 
    color: '#7C3AED', 
    icon: 'star-outline' as const,
    bgColor: 'rgba(124, 58, 237, 0.12)'
  },
  failed: {
    label: 'Échoué',
    color: COLORS.danger,
    icon: 'close-circle-outline' as const,
    bgColor: 'rgba(220, 53, 69, 0.1)',
  },
};

export const APP_CONFIG = {
  supportPhone: '+22370000000', // Remplace par ton vrai numéro Mali
  supportWhatsApp: '+22370000000',
  /** Contact pour litiges / annulation côté acheteur B2B */
  supportEmail: 'support@a2-expres.com',
  currency: 'FCFA',
  defaultShippingCost: 2000,
  /**
   * URL de suivi colis (optionnel). Si vide, seul le numéro est affiché (pas d’URL factice).
   * Exemple : https://exemple-transporteur.com/track?num=
   */
  shippingTrackingUrlBase: '' as string,
};