// apps/mobile/src/types/auth.ts
import { Timestamp } from 'firebase/firestore';

export type UserRole = 'super-admin' | 'admin' | 'seller' | 'customer' | 'visitor';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber: string | null;
  emailVerified: boolean;
  providerData: any[];
}

export interface UserProfile {
  uid: string;
  /** Peut être `""` pour un compte téléphone sans e-mail. */
  email: string;
  displayName: string;
  /** Nom / prénom saisi (comptes téléphone). */
  name?: string;
  role: UserRole;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isActive: boolean;
  phoneNumber?: string;
  photoURL?: string;
  address?: string;
  providerId?: string;
  socialAccounts?: {
    google?: boolean;
    facebook?: boolean;
    apple?: boolean;
  };
  /** ID document Firestore `companies/{companyId}` */
  companyId?: string;
  lastLogin?: Timestamp;
  sellerInfo?: SellerInfo;
  adminInfo?: AdminInfo;
}

export interface SellerInfo {
  shopName?: string;
  description?: string;
  phone?: string;
  address?: string;
  isVerified?: boolean;
  rating?: number;
  totalSales?: number;
  businessType?: string;
  categories?: string[];
  openingHours?: {
    [day: string]: {
      open: string;
      close: string;
      isClosed: boolean;
    }
  };
}

export interface AdminInfo {
  permissions: string[];
  department?: string;
  accessLevel: number;
  managedSellers?: string[];
}

// Permissions par rôle
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  'super-admin': ['*'],
  'admin': ['read', 'write', 'manage_users', 'manage_products', 'manage_orders', 'analytics', 'settings'],
  'seller': ['read', 'write_own_products', 'manage_own_orders', 'manage_shop', 'view_analytics'],
  'customer': ['read', 'create_order', 'manage_profile', 'view_history', 'write_reviews'],
  'visitor': ['read_public']
};

// Vérifier les permissions
export const checkPermission = (userRole: UserRole, permission: string): boolean => {
  const permissions = ROLE_PERMISSIONS[userRole];
  return permissions.includes('*') || permissions.includes(permission);
};