// services/firebase/companyService.ts
import { db } from "../../config/firebase"; // ← CORRECTION ICI
import { 
  doc, 
  getDoc, 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy,
  limit
} from "firebase/firestore";

// Interface basée sur votre structure Firestore exacte
export interface Company {
  // Identifiants
  id: string;
  uid: string;
  
  // Informations de base
  name: string;
  description: string;
  email: string;
  phone: string;
  
  // Images
  logo?: string;
  coverImage?: string;
  
  // Localisation
  address?: {
    street: string;
    city: string;
    country: string;
  };
  location?: string;
  
  // Catégories
  categories: string[];
  mainCategory: string;
  mainProducts: string;
  
  // Type d'entreprise
  businessType: string;
  type: string;
  
  // Statistiques
  stats?: {
    productCount: number;
    orderCount: number;
    totalProducts: number;
    totalOrders: number;
    rating: number;
    reviewCount: number;
  };
  productCount?: number;
  rating: number;
  
  // Informations commerciales
  annualRevenue?: string;
  employees?: string;
  yearEstablished: number;
  yearsOnPlatform: number;
  
  // Certifications et badges
  certifications?: string[];
  badges?: string[];
  goldSupplier?: boolean;
  tradeAssurance?: boolean;
  
  // Vérification
  verification?: {
    status: string;
    verified: boolean;
    badges?: string[];
  };
  verified?: boolean;
  
  // Performance
  responseRate: number;
  responseTime: string;
  
  // État
  isActive: boolean;
  
  // Dates
  createdAt: any;
  updatedAt: any;
}

// ✅ 1. GET COMPANY BY ID
export async function getCompanyById(companyId: string): Promise<Company> {
  try {
    const companyDoc = doc(db, "companies", companyId);
    const companySnapshot = await getDoc(companyDoc);
    
    if (!companySnapshot.exists()) {
      throw new Error(`Entreprise ${companyId} non trouvée`);
    }
    
    const data = companySnapshot.data();
    
    return {
      id: companySnapshot.id,
      uid: data.uid || companySnapshot.id,
      name: data.name || "Entreprise sans nom",
      description: data.description || "",
      email: data.email || "",
      phone: data.phone || "",
      logo: data.logo,
      coverImage: data.coverImage,
      address: data.address,
      location: data.location,
      categories: data.categories || [],
      mainCategory: data.mainCategory || "",
      mainProducts: data.mainProducts || "",
      businessType: data.businessType || "",
      type: data.type || "",
      stats: data.stats || {
        productCount: 0,
        orderCount: 0,
        totalProducts: 0,
        totalOrders: 0,
        rating: 0,
        reviewCount: 0
      },
      productCount: data.productCount || data.stats?.productCount || 0,
      rating: data.rating || 0,
      annualRevenue: data.annualRevenue,
      employees: data.employees,
      yearEstablished: data.yearEstablished || 2024,
      yearsOnPlatform: data.yearsOnPlatform || 0,
      certifications: data.certifications,
      badges: data.badges,
      goldSupplier: data.goldSupplier || false,
      tradeAssurance: data.tradeAssurance || false,
      verification: data.verification || {
        status: "pending",
        verified: false,
        badges: []
      },
      verified: data.verified || false,
      responseRate: data.responseRate || 0,
      responseTime: data.responseTime || "",
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: data.createdAt || null,
      updatedAt: data.updatedAt || null
    };
    
  } catch (error) {
    console.error("❌ getCompanyById error:", error);
    throw error;
  }
}

// ✅ 2. GET ALL COMPANIES (ACTIVES)
export async function getAllCompanies(): Promise<Company[]> {
  try {
    const companiesRef = collection(db, "companies");
    const q = query(
      companiesRef, 
      where("isActive", "==", true),
      orderBy("name")
    );
    
    const querySnapshot = await getDocs(q);
    
    const companies: Company[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      
      companies.push({
        id: doc.id,
        uid: data.uid || doc.id,
        name: data.name || "Entreprise sans nom",
        description: data.description || "",
        email: data.email || "",
        phone: data.phone || "",
        logo: data.logo,
        coverImage: data.coverImage,
        address: data.address,
        location: data.location,
        categories: data.categories || [],
        mainCategory: data.mainCategory || "",
        mainProducts: data.mainProducts || "",
        businessType: data.businessType || "",
        type: data.type || "",
        stats: data.stats || {
          productCount: 0,
          orderCount: 0,
          totalProducts: 0,
          totalOrders: 0,
          rating: 0,
          reviewCount: 0
        },
        productCount: data.productCount || data.stats?.productCount || 0,
        rating: data.rating || 0,
        annualRevenue: data.annualRevenue,
        employees: data.employees,
        yearEstablished: data.yearEstablished || 2024,
        yearsOnPlatform: data.yearsOnPlatform || 0,
        certifications: data.certifications,
        badges: data.badges,
        goldSupplier: data.goldSupplier || false,
        tradeAssurance: data.tradeAssurance || false,
        verification: data.verification || {
          status: "pending",
          verified: false,
          badges: []
        },
        verified: data.verified || false,
        responseRate: data.responseRate || 0,
        responseTime: data.responseTime || "",
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null
      });
    });
    
    return companies;
    
  } catch (error) {
    console.error("❌ getAllCompanies error:", error);
    return [];
  }
}

// ✅ 3. GET COMPANIES BY CATEGORY
export async function getCompaniesByCategory(categoryId: string): Promise<Company[]> {
  try {
    const companiesRef = collection(db, "companies");
    const q = query(
      companiesRef,
      where("isActive", "==", true),
      where("categories", "array-contains", categoryId),
      orderBy("name")
    );
    
    const querySnapshot = await getDocs(q);
    
    const companies: Company[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      
      companies.push({
        id: doc.id,
        uid: data.uid || doc.id,
        name: data.name || "Entreprise sans nom",
        description: data.description || "",
        email: data.email || "",
        phone: data.phone || "",
        logo: data.logo,
        coverImage: data.coverImage,
        address: data.address,
        location: data.location,
        categories: data.categories || [],
        mainCategory: data.mainCategory || "",
        mainProducts: data.mainProducts || "",
        businessType: data.businessType || "",
        type: data.type || "",
        stats: data.stats || {
          productCount: 0,
          orderCount: 0,
          totalProducts: 0,
          totalOrders: 0,
          rating: 0,
          reviewCount: 0
        },
        productCount: data.productCount || data.stats?.productCount || 0,
        rating: data.rating || 0,
        annualRevenue: data.annualRevenue,
        employees: data.employees,
        yearEstablished: data.yearEstablished || 2024,
        yearsOnPlatform: data.yearsOnPlatform || 0,
        certifications: data.certifications,
        badges: data.badges,
        goldSupplier: data.goldSupplier || false,
        tradeAssurance: data.tradeAssurance || false,
        verification: data.verification || {
          status: "pending",
          verified: false,
          badges: []
        },
        verified: data.verified || false,
        responseRate: data.responseRate || 0,
        responseTime: data.responseTime || "",
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null
      });
    });
    
    return companies;
    
  } catch (error) {
    console.error("❌ getCompaniesByCategory error:", error);
    return [];
  }
}

// ✅ 4. GET TOP COMPANIES (BY PRODUCT COUNT)
export async function getTopCompanies(limitCount: number = 10): Promise<Company[]> {
  try {
    const companiesRef = collection(db, "companies");
    const q = query(
      companiesRef,
      where("isActive", "==", true),
      orderBy("stats.productCount", "desc"),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    
    const companies: Company[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      
      companies.push({
        id: doc.id,
        uid: data.uid || doc.id,
        name: data.name || "Entreprise sans nom",
        description: data.description || "",
        email: data.email || "",
        phone: data.phone || "",
        logo: data.logo,
        coverImage: data.coverImage,
        address: data.address,
        location: data.location,
        categories: data.categories || [],
        mainCategory: data.mainCategory || "",
        mainProducts: data.mainProducts || "",
        businessType: data.businessType || "",
        type: data.type || "",
        stats: data.stats || {
          productCount: 0,
          orderCount: 0,
          totalProducts: 0,
          totalOrders: 0,
          rating: 0,
          reviewCount: 0
        },
        productCount: data.productCount || data.stats?.productCount || 0,
        rating: data.rating || 0,
        annualRevenue: data.annualRevenue,
        employees: data.employees,
        yearEstablished: data.yearEstablished || 2024,
        yearsOnPlatform: data.yearsOnPlatform || 0,
        certifications: data.certifications,
        badges: data.badges,
        goldSupplier: data.goldSupplier || false,
        tradeAssurance: data.tradeAssurance || false,
        verification: data.verification || {
          status: "pending",
          verified: false,
          badges: []
        },
        verified: data.verified || false,
        responseRate: data.responseRate || 0,
        responseTime: data.responseTime || "",
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null
      });
    });
    
    return companies;
    
  } catch (error) {
    console.error("❌ getTopCompanies error:", error);
    
    // Fallback: get all and sort manually
    const allCompanies = await getAllCompanies();
    return allCompanies
      .sort((a, b) => (b.productCount || 0) - (a.productCount || 0))
      .slice(0, limitCount);
  }
}

// ✅ 5. SEARCH COMPANIES
export async function searchCompanies(searchTerm: string): Promise<Company[]> {
  try {
    const allCompanies = await getAllCompanies();
    
    if (!searchTerm.trim()) return allCompanies;
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    return allCompanies.filter(company => {
      const name = company.name?.toLowerCase() || "";
      const description = company.description?.toLowerCase() || "";
      const mainProducts = company.mainProducts?.toLowerCase() || "";
      const businessType = company.businessType?.toLowerCase() || "";
      
      return (
        name.includes(lowerSearchTerm) || 
        description.includes(lowerSearchTerm) ||
        mainProducts.includes(lowerSearchTerm) ||
        businessType.includes(lowerSearchTerm)
      );
    });
    
  } catch (error) {
    console.error("❌ searchCompanies error:", error);
    return [];
  }
}

// ✅ 6. GET COMPANIES COUNT
export async function getCompaniesCount(): Promise<number> {
  try {
    const companies = await getAllCompanies();
    return companies.length;
  } catch (error) {
    console.error("❌ getCompaniesCount error:", error);
    return 0;
  }
}

// ✅ 7. GET COMPANIES BY OWNER
export async function getCompaniesByOwner(ownerId: string): Promise<Company[]> {
  try {
    const companiesRef = collection(db, "companies");
    const q = query(
      companiesRef,
      where("isActive", "==", true),
      where("uid", "==", ownerId),
      orderBy("name")
    );
    
    const querySnapshot = await getDocs(q);
    
    const companies: Company[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      
      companies.push({
        id: doc.id,
        uid: data.uid || doc.id,
        name: data.name || "Entreprise sans nom",
        description: data.description || "",
        email: data.email || "",
        phone: data.phone || "",
        logo: data.logo,
        coverImage: data.coverImage,
        address: data.address,
        location: data.location,
        categories: data.categories || [],
        mainCategory: data.mainCategory || "",
        mainProducts: data.mainProducts || "",
        businessType: data.businessType || "",
        type: data.type || "",
        stats: data.stats || {
          productCount: 0,
          orderCount: 0,
          totalProducts: 0,
          totalOrders: 0,
          rating: 0,
          reviewCount: 0
        },
        productCount: data.productCount || data.stats?.productCount || 0,
        rating: data.rating || 0,
        annualRevenue: data.annualRevenue,
        employees: data.employees,
        yearEstablished: data.yearEstablished || 2024,
        yearsOnPlatform: data.yearsOnPlatform || 0,
        certifications: data.certifications,
        badges: data.badges,
        goldSupplier: data.goldSupplier || false,
        tradeAssurance: data.tradeAssurance || false,
        verification: data.verification || {
          status: "pending",
          verified: false,
          badges: []
        },
        verified: data.verified || false,
        responseRate: data.responseRate || 0,
        responseTime: data.responseTime || "",
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null
      });
    });
    
    return companies;
    
  } catch (error) {
    console.error("❌ getCompaniesByOwner error:", error);
    return [];
  }
}