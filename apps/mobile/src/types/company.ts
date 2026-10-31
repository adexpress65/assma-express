// src/types/company.ts
export interface Company {
  id: string;
  name: string;
  logo?: string;
  category: string;
  status: 'online' | 'away' | 'offline' | 'busy';
  verified: boolean;
  chatEnabled: boolean;
  responseTime: string;
  rating?: number;
  businessHours?: {
    open: string;
    close: string;
    timezone: string;
  };
}

// src/types/product.ts
export interface Product {
  id: string;
  name: string;
  price: number;
  images: string[];
  category: string;
  companyId: string;
  description?: string;
}