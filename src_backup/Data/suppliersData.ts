// Types partagés
import { Ionicons } from "@expo/vector-icons";

export interface TabItem {
  id: string;
  label: string;
  active?: boolean;
}
export interface ActionItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}
export interface Product {
  id: string;
  name: string;
  image: string;
  price: string;
  originalPrice?: string;
  discount?: number;
  label?: string;
  moq: string;
  isNew?: boolean;
  isHot?: boolean;
}
export interface Supplier {
  id: string;
  name: string;
  logo: string;
  verified: boolean;
  verificationLevel: string;
  details: string;
  responseTime: string;
  deliveryRate: string;
  location: string;
  mainProducts: string[];
  products: Product[];
  isAd?: boolean;
  transactionVolume: string;
  yearsInBusiness: number;
}

// Tabs header
export const headerTabs: TabItem[] = [
  { id: "products", label: "Produits" },
  { id: "suppliers", label: "Fabricants", active: true },
  { id: "global", label: "Mondial" },
];

// Quick actions (icônes Ionicons strict typées)
export const quickActions: ActionItem[] = [
  { icon: "grid-outline", label: "Catégories" },
  { icon: "document-text-outline", label: "Demander un devis" },
  { icon: "business-outline", label: "Salon en ligne" },
  { icon: "storefront-outline", label: "Salle d'exposition" },
  { icon: "camera-outline", label: "Recherche par image" },
  { icon: "airplane-outline", label: "Services logistiques" },
  { icon: "globe-outline", label: "Commerce international" },
  { icon: "people-outline", label: "Réseau fournisseurs" },
];

// Sections horizontales
export const sampleProducts: Product[] = [
  { id: "1", name: "Montre connectée premium", image: "https://picsum.photos/200/200?random=1", price: "3 373 F CFA", originalPrice: "4 216 F CFA", discount: 20, label: "Prix de l'échantillon", moq: "1 pièce (MOQ)", isNew: true },
  { id: "2", name: "Cosmétiques bio naturels", image: "https://picsum.photos/200/200?random=2", price: "2 907 F CFA", originalPrice: "3 634 F CFA", discount: 20, label: "Prix de l'échantillon", moq: "2 pièces (MOQ)", isHot: true },
  { id: "3", name: "Équipement sportif pro", image: "https://picsum.photos/200/200?random=3", price: "17 436 F CFA", originalPrice: "21 795 F CFA", discount: 20, label: "Prix de l'échantillon", moq: "1 pièce (MOQ)" },
  { id: "4", name: "Sacs mode luxury", image: "https://picsum.photos/200/200?random=4", price: "5 248 F CFA", originalPrice: "6 560 F CFA", discount: 20, label: "Prix de l'échantillon", moq: "3 pièces (MOQ)", isNew: true },
  { id: "5", name: "Électronique high-tech", image: "https://picsum.photos/200/200?random=5", price: "8 742 F CFA", originalPrice: "10 927 F CFA", discount: 20, label: "Prix de l'échantillon", moq: "2 pièces (MOQ)", isHot: true },
  { id: "6", name: "Accessoires mode tendance", image: "https://picsum.photos/200/200?random=6", price: "1 583 F CFA", originalPrice: "1 979 F CFA", discount: 20, label: "Prix de l'échantillon", moq: "5 pièces (MOQ)" },
  { id: "7", name: "Outils bricolage pros", image: "https://picsum.photos/200/200?random=7", price: "4 500 F CFA", moq: "1 pièce (MOQ)", isNew: true },
  { id: "8", name: "Jouets éducatifs enfants", image: "https://picsum.photos/200/200?random=8", price: "2 000 F CFA", moq: "10 pièces (MOQ)", isHot: true },
];

export const customizableProducts: Product[] = [
  { id: "1", name: "T-shirts personnalisés logo", image: "https://picsum.photos/200/200?random=7", price: "", moq: "Dès 10 pièces" },
  { id: "2", name: "Goodies entreprise custom", image: "https://picsum.photos/200/200?random=8", price: "", moq: "Dès 50 pièces" },
  { id: "3", name: "Emballages logo premium", image: "https://picsum.photos/200/200?random=9", price: "", moq: "Dès 100 pièces" },
  { id: "4", name: "Accessoires branding pro", image: "https://picsum.photos/200/200?random=10", price: "", moq: "Dès 20 pièces" },
  { id: "5", name: "Produits promo personnalisés", image: "https://picsum.photos/200/200?random=11", price: "", moq: "Dès 30 pièces" },
  { id: "6", name: "Articles pub customisés", image: "https://picsum.photos/200/200?random=12", price: "", moq: "Dès 15 pièces" },
  { id: "7", name: "Mugs personnalisés", image: "https://picsum.photos/200/200?random=13", price: "", moq: "Dès 25 pièces" },
  { id: "8", name: "Stylos branding", image: "https://picsum.photos/200/200?random=14", price: "", moq: "Dès 100 pièces" },
];

export const trendingProducts: Product[] = [
  { id: "t1", name: "Trotinette électrique urbaine", image: "https://picsum.photos/200/200?random=15", price: "150 000 F CFA", moq: "1 pièce (MOQ)", isHot: true },
  { id: "t2", name: "Chaussures running pro", image: "https://picsum.photos/200/200?random=16", price: "25 000 F CFA", moq: "2 pièces (MOQ)", isNew: true },
  { id: "t3", name: "Maquillage kit complet", image: "https://picsum.photos/200/200?random=17", price: "10 000 F CFA", moq: "5 pièces (MOQ)" },
  { id: "t4", name: "Montres quartz luxury", image: "https://picsum.photos/200/200?random=18", price: "50 000 F CFA", moq: "1 pièce (MOQ)", isHot: true },
  { id: "t5", name: "Sacs à dos voyage", image: "https://picsum.photos/200/200?random=19", price: "15 000 F CFA", moq: "3 pièces (MOQ)" },
  { id: "t6", name: "Écouteurs sans fil", image: "https://picsum.photos/200/200?random=20", price: "8 000 F CFA", moq: "10 pièces (MOQ)", isNew: true },
];

// ======= Fournisseurs (12) =======
export const suppliersData: Supplier[] = [
  {
    id: "1",
    name: "Flyedi Co., Ltd.",
    logo: "https://picsum.photos/50/50?random=1",
    verified: true,
    verificationLevel: "Verified 3 yrs",
    details: "130+ personnel · 5,200+ m² · US$15,000,000+",
    responseTime: "≤3h",
    deliveryRate: "100.0%",
    location: "Guangdong, China",
    mainProducts: ["Chaussures", "Vêtements", "Accessoires"],
    transactionVolume: "US$10M+",
    yearsInBusiness: 3,
    products: [
      { id: "p1", image: "https://picsum.photos/150/150?random=11", price: "873 F CFA", moq: "2 pièces (MOQ)", name: "Chaussures cuir homme", discount: 15, isHot: true },
      { id: "p2", image: "https://picsum.photos/150/150?random=12", price: "750 F CFA", moq: "2 pièces (MOQ)", name: "Baskets sport", isNew: true },
      { id: "p3", image: "https://picsum.photos/150/150?random=13", price: "14 878 F CFA", moq: "1 pièce (MOQ)", name: "Chaussures luxury" },
      { id: "p4", image: "https://picsum.photos/150/150?random=14", price: "2 456 F CFA", originalPrice: "3 070 F CFA", moq: "5 pièces (MOQ)", name: "Sandales été", discount: 20 },
      { id: "p5", image: "https://picsum.photos/150/150?random=15", price: "3 829 F CFA", moq: "3 pièces (MOQ)", name: "Chaussures travail", isHot: true },
    ],
  },
  {
    id: "2",
    name: "Shenzhen Cms Cosmetics Co., Ltd.",
    logo: "https://picsum.photos/50/50?random=2",
    verified: true,
    verificationLevel: "Verified 5 yrs",
    details: "20+ personnel · 2,300+ m² · US$840,000+",
    responseTime: "≤4h",
    deliveryRate: "96.9%",
    location: "Shenzhen, China",
    mainProducts: ["Cosmétiques", "Pinceaux maquillage", "Accessoires beauté"],
    transactionVolume: "US$5M+",
    yearsInBusiness: 5,
    isAd: true,
    products: [
      { id: "p1", image: "https://picsum.photos/150/150?random=21", price: "2 094 F CFA", moq: "1 pièce (MOQ)", name: "Pinceaux maquillage pro", isNew: true },
      { id: "p2", image: "https://picsum.photos/150/150?random=22", price: "8 134 F CFA", moq: "2 jeux (MOQ)", name: "Kit cosmétiques" },
      { id: "p3", image: "https://picsum.photos/150/150?random=23", price: "1 163 F CFA", moq: "1 jeu (MOQ)", name: "Outils beauté" },
      { id: "p4", image: "https://picsum.photos/150/150?random=24", price: "3 500 F CFA", moq: "5 pièces (MOQ)", name: "Palettes maquillage", discount: 10 },
      { id: "p5", image: "https://picsum.photos/150/150?random=25", price: "4 200 F CFA", moq: "3 pièces (MOQ)", name: "Crèmes soin", isHot: true },
    ],
  },
  {
    id: "3",
    name: "Guangzhou Shiyi Watch Co., Ltd.",
    logo: "https://picsum.photos/50/50?random=3",
    verified: true,
    verificationLevel: "Verified 4 yrs",
    details: "50+ personnel · 3,000+ m² · US$2,500,000+",
    responseTime: "≤2h",
    deliveryRate: "98.5%",
    location: "Guangzhou, China",
    mainProducts: ["Montres", "Horloges", "Accessoires temps"],
    transactionVolume: "US$8M+",
    yearsInBusiness: 4,
    products: [
      { id: "p1", image: "https://picsum.photos/150/150?random=31", price: "5 000 F CFA", moq: "1 pièce (MOQ)", name: "Montre quartz", isHot: true },
      { id: "p2", image: "https://picsum.photos/150/150?random=32", price: "10 000 F CFA", moq: "2 pièces (MOQ)", name: "Montre connectée" },
      { id: "p3", image: "https://picsum.photos/150/150?random=33", price: "15 000 F CFA", moq: "1 pièce (MOQ)", name: "Horloge murale" },
      { id: "p4", image: "https://picsum.photos/150/150?random=34", price: "7 500 F CFA", originalPrice: "9 375 F CFA", moq: "3 pièces (MOQ)", name: "Bracelet montre", discount: 20 },
      { id: "p5", image: "https://picsum.photos/150/150?random=35", price: "12 000 F CFA", moq: "2 pièces (MOQ)", name: "Montre luxury", isNew: true },
    ],
  },
  {
    id: "4",
    name: "Ningbo Tech Gadgets Co., Ltd.",
    logo: "https://picsum.photos/50/50?random=4",
    verified: true,
    verificationLevel: "Verified 6 yrs",
    details: "100+ personnel · 4,500+ m² · US$10,000,000+",
    responseTime: "≤3h",
    deliveryRate: "99.2%",
    location: "Ningbo, China",
    mainProducts: ["Gadgets tech", "Électronique", "Accessoires mobile"],
    transactionVolume: "US$15M+",
    yearsInBusiness: 6,
    isAd: true,
    products: [
      { id: "p1", image: "https://picsum.photos/150/150?random=41", price: "2 500 F CFA", moq: "5 pièces (MOQ)", name: "Chargeur sans fil" },
      { id: "p2", image: "https://picsum.photos/150/150?random=42", price: "4 000 F CFA", moq: "3 pièces (MOQ)", name: "Écouteurs Bluetooth", isHot: true },
      { id: "p3", image: "https://picsum.photos/150/150?random=43", price: "6 000 F CFA", moq: "2 pièces (MOQ)", name: "Support téléphone" },
      { id: "p4", image: "https://picsum.photos/150/150?random=44", price: "3 200 F CFA", originalPrice: "4 000 F CFA", moq: "4 pièces (MOQ)", name: "Câbles USB", discount: 20 },
      { id: "p5", image: "https://picsum.photos/150/150?random=45", price: "5 500 F CFA", moq: "1 pièce (MOQ)", name: "Power bank", isNew: true },
    ],
  },
  {
    id: "5",
    name: "Shanghai Fashion Apparel Co., Ltd.",
    logo: "https://picsum.photos/50/50?random=5",
    verified: true,
    verificationLevel: "Verified 7 yrs",
    details: "200+ personnel · 6,000+ m² · US$20,000,000+",
    responseTime: "≤4h",
    deliveryRate: "97.8%",
    location: "Shanghai, China",
    mainProducts: ["Vêtements", "Mode", "Textiles"],
    transactionVolume: "US$25M+",
    yearsInBusiness: 7,
    products: [
      { id: "p1", image: "https://picsum.photos/150/150?random=51", price: "1 500 F CFA", moq: "10 pièces (MOQ)", name: "T-shirts coton" },
      { id: "p2", image: "https://picsum.photos/150/150?random=52", price: "3 000 F CFA", moq: "5 pièces (MOQ)", name: "Jeans slim", isNew: true },
      { id: "p3", image: "https://picsum.photos/150/150?random=53", price: "4 500 F CFA", moq: "3 pièces (MOQ)", name: "Robes été" },
      { id: "p4", image: "https://picsum.photos/150/150?random=54", price: "2 800 F CFA", originalPrice: "3 500 F CFA", moq: "6 pièces (MOQ)", name: "Chemises", discount: 20 },
      { id: "p5", image: "https://picsum.photos/150/150?random=55", price: "5 000 F CFA", moq: "2 pièces (MOQ)", name: "Vestes hiver", isHot: true },
    ],
  },
  {
    id: "6",
    name: "Beijing Auto Parts Co., Ltd.",
    logo: "https://picsum.photos/50/50?random=6",
    verified: true,
    verificationLevel: "Verified 5 yrs",
    details: "150+ personnel · 5,000+ m² · US$12,000,000+",
    responseTime: "≤2h",
    deliveryRate: "98.0%",
    location: "Beijing, China",
    mainProducts: ["Pièces auto", "Véhicules", "Accessoires transport"],
    transactionVolume: "US$18M+",
    yearsInBusiness: 5,
    products: [
      { id: "p1", image: "https://picsum.photos/150/150?random=61", price: "10 000 F CFA", moq: "1 pièce (MOQ)", name: "Pneus tout terrain" },
      { id: "p2", image: "https://picsum.photos/150/150?random=62", price: "5 000 F CFA", moq: "2 pièces (MOQ)", name: "Freins disque", isHot: true },
      { id: "p3", image: "https://picsum.photos/150/150?random=63", price: "7 500 F CFA", moq: "3 pièces (MOQ)", name: "Batteries auto" },
      { id: "p4", image: "https://picsum.photos/150/150?random=64", price: "4 000 F CFA", originalPrice: "5 000 F CFA", moq: "4 pièces (MOQ)", name: "Filtres huile", discount: 20 },
      { id: "p5", image: "https://picsum.photos/150/150?random=65", price: "6 000 F CFA", moq: "2 pièces (MOQ)", name: "Accessoires intérieurs", isNew: true },
    ],
  },
  {
    id: "7",
    name: "Hangzhou Home Decor Co., Ltd.",
    logo: "https://picsum.photos/50/50?random=7",
    verified: true,
    verificationLevel: "Verified 4 yrs",
    details: "80+ personnel · 3,500+ m² · US$8,000,000+",
    responseTime: "≤3h",
    deliveryRate: "96.5%",
    location: "Hangzhou, China",
    mainProducts: ["Décoration maison", "Meubles", "Textiles home"],
    transactionVolume: "US$10M+",
    yearsInBusiness: 4,
    isAd: true,
    products: [
      { id: "p1", image: "https://picsum.photos/150/150?random=71", price: "3 000 F CFA", moq: "5 pièces (MOQ)", name: "Coussins déco" },
      { id: "p2", image: "https://picsum.photos/150/150?random=72", price: "15 000 F CFA", moq: "1 pièce (MOQ)", name: "Lampes salon", isNew: true },
      { id: "p3", image: "https://picsum.photos/150/150?random=73", price: "20 000 F CFA", moq: "1 pièce (MOQ)", name: "Tapis sol" },
      { id: "p4", image: "https://picsum.photos/150/150?random=74", price: "8 000 F CFA", originalPrice: "10 000 F CFA", moq: "2 pièces (MOQ)", name: "Rideaux", discount: 20 },
      { id: "p5", image: "https://picsum.photos/150/150?random=75", price: "12 000 F CFA", moq: "2 pièces (MOQ)", name: "Vases déco", isHot: true },
    ],
  },
  {
    id: "8",
    name: "Tianjin Sports Equipment Co., Ltd.",
    logo: "https://picsum.photos/50/50?random=8",
    verified: true,
    verificationLevel: "Verified 6 yrs",
    details: "120+ personnel · 4,800+ m² · US$15,000,000+",
    responseTime: "≤4h",
    deliveryRate: "97.0%",
    location: "Tianjin, China",
    mainProducts: ["Équipements sport", "Fitness", "Outdoor"],
    transactionVolume: "US$20M+",
    yearsInBusiness: 6,
    products: [
      { id: "p1", image: "https://picsum.photos/150/150?random=81", price: "25 000 F CFA", moq: "1 pièce (MOQ)", name: "Vélos fitness" },
      { id: "p2", image: "https://picsum.photos/150/150?random=82", price: "5 000 F CFA", moq: "5 pièces (MOQ)", name: "Haltères", isHot: true },
      { id: "p3", image: "https://picsum.photos/150/150?random=83", price: "10 000 F CFA", moq: "3 pièces (MOQ)", name: "Tapis yoga" },
      { id: "p4", image: "https://picsum.photos/150/150?random=84", price: "15 000 F CFA", originalPrice: "18 750 F CFA", moq: "2 pièces (MOQ)", name: "Ballons sport", discount: 20 },
      { id: "p5", image: "https://picsum.photos/150/150?random=85", price: "20 000 F CFA", moq: "1 pièce (MOQ)", name: "Équipements gym", isNew: true },
    ],
  },
  {
    id: "9",
    name: "Qingdao Toys Manufacturing Co., Ltd.",
    logo: "https://picsum.photos/50/50?random=9",
    verified: true,
    verificationLevel: "Verified 3 yrs",
    details: "90+ personnel · 3,200+ m² · US$6,000,000+",
    responseTime: "≤2h",
    deliveryRate: "98.8%",
    location: "Qingdao, China",
    mainProducts: ["Jouets", "Jeux éducatifs", "Enfants produits"],
    transactionVolume: "US$9M+",
    yearsInBusiness: 3,
    products: [
      { id: "p1", image: "https://picsum.photos/150/150?random=91", price: "2 000 F CFA", moq: "10 pièces (MOQ)", name: "Puzzles éducatifs" },
      { id: "p2", image: "https://picsum.photos/150/150?random=92", price: "3 500 F CFA", moq: "5 pièces (MOQ)", name: "Jouets en bois", isNew: true },
      { id: "p3", image: "https://picsum.photos/150/150?random=93", price: "1 500 F CFA", moq: "20 pièces (MOQ)", name: "Peluches" },
      { id: "p4", image: "https://picsum.photos/150/150?random=94", price: "4 000 F CFA", originalPrice: "5 000 F CFA", moq: "4 pièces (MOQ)", name: "Jeux de société", discount: 20 },
      { id: "p5", image: "https://picsum.photos/150/150?random=95", price: "2 500 F CFA", moq: "8 pièces (MOQ)", name: "Voitures miniatures", isHot: true },
    ],
  },
  {
    id: "10",
    name: "Wuhan Medical Supplies Co., Ltd.",
    logo: "https://picsum.photos/50/50?random=10",
    verified: true,
    verificationLevel: "Verified 5 yrs",
    details: "110+ personnel · 4,000+ m² · US$11,000,000+",
    responseTime: "≤3h",
    deliveryRate: "99.5%",
    location: "Wuhan, China",
    mainProducts: ["Fournitures médicales", "Équipements santé", "Masques"],
    transactionVolume: "US$14M+",
    yearsInBusiness: 5,
    isAd: true,
    products: [
      { id: "p1", image: "https://picsum.photos/150/150?random=101", price: "500 F CFA", moq: "100 pièces (MOQ)", name: "Masques chirurgicaux" },
            { id: "p2", image: "https://picsum.photos/150/150?random=102", price: "1 000 F CFA", moq: "50 pièces (MOQ)", name: "Gants médicaux" },
      { id: "p3", image: "https://picsum.photos/150/150?random=103", price: "2 500 F CFA", moq: "20 pièces (MOQ)", name: "Thermomètres infrarouges" },
      { id: "p4", image: "https://picsum.photos/150/150?random=104", price: "15 000 F CFA", moq: "5 pièces (MOQ)", name: "Tensiomètres automatiques", discount: 15 },
      { id: "p5", image: "https://picsum.photos/150/150?random=105", price: "10 000 F CFA", moq: "10 pièces (MOQ)", name: "Oxymètres de pouls", isHot: true }
    ]
  }
];

