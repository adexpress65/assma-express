import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

/**
 * ✅ Healthcheck
 */
app.get("/", (_req, res) => {
  res.json({ message: "🚀 ASSMA API is running" });
});

/**
 * ✅ Récupérer toutes les catégories avec leurs produits
 */
app.get("/categories", async (_req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: { products: true },
    });
    res.json(categories);
  } catch (err) {
    console.error("Erreur /categories:", err);
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération des catégories" });
  }
});

/**
 * ✅ Récupérer tous les produits
 */
app.get("/products", async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(products);
  } catch (err) {
    console.error("Erreur /products:", err);
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération des produits" });
  }
});

/**
 * ✅ Récupérer un produit par ID
 */
app.get("/products/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const product = await prisma.product.findUnique({
      where: { id: String(id) }, // ✅ forcer en string
      include: { category: true, owner: true },
    });

    if (!product) {
      return res.status(404).json({ error: "Produit non trouvé" });
    }

    res.json(product);
  } catch (err) {
    console.error("Erreur /products/:id:", err);
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération du produit" });
  }
});

/**
 * ✅ Produits d’une catégorie (ancienne route)
 */
app.get("/categories/:id/products", async (req, res) => {
  const { id } = req.params;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;

  try {
    const products = await prisma.product.findMany({
      where: { categoryId: String(id) }, // ✅ forcer en string
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    res.json(products);
  } catch (err) {
    console.error("Erreur /categories/:id/products:", err);
    res.status(500).json({
      error: "Erreur lors de la récupération des produits par catégorie",
    });
  }
});

/**
 * ✅ Alias compatible frontend : /products/by-category/:id
 */
app.get("/products/by-category/:id", async (req, res) => {
  const { id } = req.params;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;

  try {
    const products = await prisma.product.findMany({
      where: { categoryId: String(id) }, // ✅ forcer en string
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    res.json(products);
  } catch (err) {
    console.error("Erreur /products/by-category/:id:", err);
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération des produits" });
  }
});

/**
 * ✅ Derniers produits (pour "Laissez-vous inspirer")
 */
app.get("/products/latest", async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 10;

  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    res.json(products);
  } catch (err) {
    console.error("Erreur /products/latest:", err);
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération des derniers produits" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 API démarrée sur http://localhost:${PORT}`);
});
