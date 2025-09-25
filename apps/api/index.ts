import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

// 🔹 Route de test
app.get("/", (req, res) => {
  res.json({ message: "API OK 🚀" });
});

// 🔹 Récupérer toutes les catégories avec produits
app.get("/categories", async (req, res) => {
  const categories = await prisma.category.findMany({
    include: { products: true },
  });
  res.json(categories);
});

// 🔹 Récupérer tous les produits
app.get("/products", async (req, res) => {
  const products = await prisma.product.findMany({
    include: { category: true },
  });
  res.json(products);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ API running on http://localhost:${PORT}`);
});
