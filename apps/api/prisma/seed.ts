import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Début du seeding...");

  // 🔹 Créer un utilisateur par défaut
  const user = await prisma.user.upsert({
    where: { email: "test@example.com" },
    update: {},
    create: {
      email: "test@example.com",
      passwordHash: "hashedpassword", // ⚠️ à remplacer par un vrai hash en prod
    },
  });
  console.log(`👤 Utilisateur créé : ${user.email}`);

  // 🔹 Catégories
  const categories = [
    "Électronique",
    "Mode",
    "Maison et jardin",
    "Beauté et santé",
    "Jouets et loisirs",
    "Matériaux de construction",
    "Automobile et motos",
    "Produits industriels",
    "Équipements de bureau",
    "Articles de fête et saisonniers",
    "Produits pour animaux",
    "Sécurité et protection",
  ];

  // 🔹 Création des catégories
  const createdCategories = [];
  for (const name of categories) {
    const category = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    createdCategories.push(category);
  }
  console.log(`📂 ${createdCategories.length} catégories insérées.`);

  // 🔹 Produits (5 par catégorie)
  const sampleProducts: Record<string, string[]> = {
    "Électronique": [
      "iPhone 15 Pro",
      "Samsung Galaxy S23",
      "Ordinateur portable Dell XPS",
      "Casque Sony WH-1000XM5",
      "TV 4K LG 55 pouces",
    ],
    "Mode": [
      "Chaussures Nike Air",
      "Veste en cuir Zara",
      "T-shirt H&M",
      "Sac Louis Vuitton",
      "Robe Mango",
    ],
    "Maison et jardin": [
      "Canapé 3 places",
      "Table basse en bois",
      "Lampe de chevet LED",
      "Tondeuse à gazon",
      "Chaise ergonomique",
    ],
    "Beauté et santé": [
      "Crème hydratante Nivea",
      "Rouge à lèvres MAC",
      "Parfum Dior",
      "Shampoing L’Oréal",
      "Complément alimentaire Omega-3",
    ],
    "Jouets et loisirs": [
      "Lego Star Wars",
      "Console Nintendo Switch",
      "Ballon Adidas",
      "Poupée Barbie",
      "Tente de camping 4 places",
    ],
    "Matériaux de construction": [
      "Sac de ciment 50kg",
      "Peinture murale blanche",
      "Échafaudage métallique",
      "Casque de chantier",
      "Perceuse Bosch",
    ],
    "Automobile et motos": [
      "Pneu Michelin",
      "Casque moto Shark",
      "Siège auto enfant",
      "Huile moteur Total",
      "Kit frein Brembo",
    ],
    "Produits industriels": [
      "Compresseur d’air",
      "Pompe hydraulique",
      "Moteur électrique",
      "Générateur diesel",
      "Produit chimique industriel",
    ],
    "Équipements de bureau": [
      "Bureau en bois",
      "Chaise de bureau",
      "Ordinateur HP",
      "Imprimante Canon",
      "Tableau blanc magnétique",
    ],
    "Articles de fête et saisonniers": [
      "Guirlandes LED",
      "Ballons d’anniversaire",
      "Costume de Père Noël",
      "Masque Halloween",
      "Feux d’artifice",
    ],
    "Produits pour animaux": [
      "Croquettes pour chiens",
      "Litière pour chats",
      "Gamelle en inox",
      "Collier pour chien",
      "Jouet en corde",
    ],
    "Sécurité et protection": [
      "Caméra de surveillance",
      "Alarme sans fil",
      "Extincteur",
      "Gants de sécurité",
      "Masque de protection",
    ],
  };

  // 🔹 Insérer les produits
  for (const category of createdCategories) {
    const products = sampleProducts[category.name] || [];
    for (const p of products) {
      await prisma.product.upsert({
        where: { name: p },
        update: {},
        create: {
          name: p,
          description: `Description de ${p}`,
          price: Math.floor(Math.random() * 500) + 50,
          imageUrl: `https://picsum.photos/seed/${encodeURIComponent(p)}/400/300`,
          ownerId: user.id,
          categoryId: category.id,
        },
      });
    }
  }

  console.log("🛒 Produits insérés dans chaque catégorie !");
  console.log("✅ Seeding terminé avec succès !");
}

main()
  .catch((e) => {
    console.error("❌ Erreur pendant le seeding :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
