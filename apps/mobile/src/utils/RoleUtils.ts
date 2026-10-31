// apps/mobile/src/utils/RoleUtils.ts

import { UserRole } from '@/contexts/AuthContext';

// Règles de validation des rôles
export const validateRoleChange = (
  currentRole: UserRole,
  newRole: UserRole,
  userMakingChange: UserRole
): { isValid: boolean; error?: string } => {
  
  // Seuls les super-admins peuvent créer/modifier des super-admins
  if (newRole === 'super-admin' && userMakingChange !== 'super-admin') {
    return {
      isValid: false,
      error: 'Seuls les super-admins peuvent créer ou modifier des super-admins'
    };
  }
  
  // Seuls les super-admins et admins peuvent créer/modifier des admins
  if (newRole === 'admin' && !['super-admin', 'admin'].includes(userMakingChange)) {
    return {
      isValid: false,
      error: 'Seuls les super-admins et admins peuvent créer ou modifier des admins'
    };
  }
  
  // Règles spécifiques
  const roleHierarchy: Record<UserRole, number> = {
    'super-admin': 4,
    'admin': 3,
    'seller': 2,
    'customer': 1,
    'visitor': 0
  };
  
  // Un utilisateur ne peut pas promouvoir quelqu'un à un rôle supérieur au sien
  if (roleHierarchy[newRole] > roleHierarchy[userMakingChange]) {
    return {
      isValid: false,
      error: 'Vous ne pouvez pas attribuer un rôle supérieur au vôtre'
    };
  }
  
  return { isValid: true };
};

// Vérifier si un rôle a accès à une fonctionnalité
export const canAccessFeature = (
  userRole: UserRole,
  feature: string,
  permissions: Record<string, UserRole[]>
): boolean => {
  const allowedRoles = permissions[feature] || [];
  
  // Les super-admins ont toujours accès
  if (userRole === 'super-admin') return true;
  
  return allowedRoles.includes(userRole);
};

// Configuration des permissions par fonctionnalité
export const FEATURE_PERMISSIONS = {
  'dashboard:admin': ['super-admin', 'admin'],
  'dashboard:seller': ['seller'],
  'users:manage': ['super-admin', 'admin'],
  'products:create': ['seller', 'admin', 'super-admin'],
  'products:delete': ['seller', 'admin', 'super-admin'],
  'orders:view_all': ['admin', 'super-admin'],
  'analytics:view': ['admin', 'super-admin'],
  'settings:manage': ['super-admin'],
  'profile:edit': ['customer', 'seller', 'admin', 'super-admin'],
};

// Obtenir le rôle le plus élevé possible pour un type d'utilisateur
export const getHighestRoleForUserType = (userType: 'customer' | 'seller' | 'admin'): UserRole => {
  switch (userType) {
    case 'admin': return 'admin';
    case 'seller': return 'seller';
    case 'customer': return 'customer';
    default: return 'customer';
  }
};